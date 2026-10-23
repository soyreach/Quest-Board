import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Submission from "@/models/Submission";
import Quest from "@/models/Quest";
import User from "@/models/User";
import { notifyUser } from "@/lib/notify";
import { saveUploadedFile } from "@/lib/upload";
import { seedHistory, submittedEvent } from "@/lib/submissionHistory";

// Statuses where the student can still swap in a new file.
const OPEN_STATUSES = ["Needs_Revision", "Submitted", "AI_PreChecked"];

// POST (multipart form) { file }
// Lets a student resubmit from their hub: the new file replaces the one on this
// submission and it goes back to the professor's review queue. Nothing is
// duplicated, so the student's list stays tidy.
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "Choose a file to upload first." }, { status: 400 });
  }

  await connectToDatabase();
  const submission = mongoose.isValidObjectId(params.id) ? await Submission.findById(params.id) : null;
  // Same answer for "missing" and "not yours" so ids can't be probed.
  if (!submission || submission.student.toString() !== session.user.id) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }
  if (!OPEN_STATUSES.includes(submission.status)) {
    return NextResponse.json(
      { error: "This quest has already been approved, so it can't be resubmitted." },
      { status: 409 }
    );
  }

  const quest = await Quest.findById(submission.quest);
  if (!quest) {
    return NextResponse.json({ error: "That quest no longer exists." }, { status: 404 });
  }

  // A professor asking for changes always gets them, even after the deadline.
  // Swapping a file that is still waiting for review is not allowed once it has passed.
  const wasRevision = submission.status === "Needs_Revision";
  if (!wasRevision && quest.deadline && new Date(quest.deadline) < new Date()) {
    return NextResponse.json(
      { error: "The deadline has passed, so you can't replace a file that is waiting for review." },
      { status: 409 }
    );
  }

  let saved;
  try {
    saved = await saveUploadedFile(file);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // One conditional update, so an approval that lands at the same moment wins cleanly.
  const updated = await Submission.findOneAndUpdate(
    { _id: submission._id, student: session.user.id, status: { $in: OPEN_STATUSES } },
    {
      $set: {
        fileUrl: saved.url,
        fileName: saved.name,
        status: "Submitted",
        aiPreCheck: null, // it described the old file
        archivedByStudent: false,
      },
      $push: { history: { $each: [...seedHistory(submission), submittedEvent("resubmitted", saved)] } },
    },
    { new: true }
  );
  if (!updated) {
    return NextResponse.json(
      { error: "This quest was just reviewed, so it can't be resubmitted." },
      { status: 409 }
    );
  }

  const student = await User.findById(session.user.id).select("name").lean();
  const who = student?.name || session.user.name || "A student";
  await notifyUser(quest.author, {
    type: "submission_received",
    title: wasRevision ? "Revised work turned in" : "Submission file replaced",
    message: wasRevision
      ? `${who} resubmitted "${quest.title}" after your revision request.`
      : `${who} replaced their file for "${quest.title}" before review.`,
    link: "/professor/dashboard",
  });

  const result = await Submission.findById(updated._id).populate("quest", "title course bountyPoints").lean();
  return NextResponse.json(JSON.parse(JSON.stringify(result)));
}
