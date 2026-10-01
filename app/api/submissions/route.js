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
import { getMySubmissions, getReviewQueue } from "@/lib/queries";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  if (searchParams.get("scope") === "mine") {
    return NextResponse.json(await getMySubmissions(session.user.id));
  }

  if (session.user.role !== "Professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(await getReviewQueue(session.user.id));
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const questId = formData.get("questId");
  const file = formData.get("file");

  if (!questId || !file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json(
      { error: "A questId and a file are required." },
      { status: 400 }
    );
  }

  // Look the quest up first: we need its professor to notify, and there's
  // no point saving a file for a quest that doesn't exist.
  await connectToDatabase();
  const quest = mongoose.isValidObjectId(questId) ? await Quest.findById(questId) : null;
  if (!quest) {
    return NextResponse.json({ error: "That quest no longer exists." }, { status: 404 });
  }

  let saved;
  try {
    saved = await saveUploadedFile(file);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // A student turning work in again after a revision request reads differently to the professor.
  const isResubmission = Boolean(
    await Submission.exists({ quest: questId, student: session.user.id, status: "Needs_Revision" })
  );

  const submission = await Submission.create({
    quest: questId,
    student: session.user.id,
    fileUrl: saved.url,
    fileName: saved.name,
    status: "Submitted",
  });

  const student = await User.findById(session.user.id).select("name").lean();
  const who = student?.name || session.user.name || "A student";
  await notifyUser(quest.author, {
    type: "submission_received",
    title: isResubmission ? "Revised work turned in" : "New submission to review",
    message: `${who} ${isResubmission ? "resubmitted" : "turned in"} "${quest.title}".`,
    link: "/professor/dashboard",
  });

  return NextResponse.json(submission, { status: 201 });
}
