import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Submission from "@/models/Submission";
import Quest from "@/models/Quest";
import User from "@/models/User";
import { saveUploadedFile } from "@/lib/upload";
import { notifyUser } from "@/lib/notify";
import { awardTierRewards } from "@/lib/tierRewards";

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const action = formData.get("action");
  const professorFeedback = formData.get("professorFeedback") || "";
  const feedbackFile = formData.get("feedbackFile");

  if (!["approve", "revise"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'revise'" }, { status: 400 });
  }

  await connectToDatabase();
  const submission = await Submission.findById(params.id);
  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const quest = await Quest.findById(submission.quest);
  // Only the professor who authored the quest can review its submissions.
  if (!quest || quest.author.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Approving awards points with $inc, so a second approve (double-click,
  // retried request) would silently double-pay the student. Refuse it.
  if (submission.status === "Professor_Approved") {
    return NextResponse.json(
      { error: "This submission has already been approved." },
      { status: 409 }
    );
  }

  let feedbackFileInfo = null;
  if (feedbackFile && typeof feedbackFile.arrayBuffer === "function") {
    try {
      feedbackFileInfo = await saveUploadedFile(feedbackFile);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  submission.professorFeedback = professorFeedback;
  if (feedbackFileInfo) {
    submission.professorFeedbackFileUrl = feedbackFileInfo.url;
    submission.professorFeedbackFileName = feedbackFileInfo.name;
  }

  if (action === "approve") {
    submission.status = "Professor_Approved";
    submission.awardedPoints = quest.bountyPoints;
    submission.archivedByStudent = false; // approved work always shows under Completed
    await submission.save();

    await User.findByIdAndUpdate(submission.student, {
      $inc: { bountyPoints: quest.bountyPoints },
    });

    await notifyUser(submission.student, {
      type: "submission_approved",
      title: "Quest approved",
      message: `"${quest.title}" was approved. You earned ${quest.bountyPoints} bounty points.`,
      link: "/student/dashboard",
    });

    // Grants any Bronze/Silver/Gold tier (and its bonus) the new total has reached.
    await awardTierRewards(submission.student);
  } else {
    submission.status = "Needs_Revision";
    submission.archivedByStudent = false; // a revision request needs the student's attention
    await submission.save();

    const note = String(professorFeedback).trim();
    await notifyUser(submission.student, {
      type: "revision_requested",
      title: "Revision requested",
      message: note
        ? `"${quest.title}": ${note.length > 120 ? note.slice(0, 117).trimEnd() + "…" : note}`
        : `"${quest.title}" needs changes. Open your dashboard for details.`,
      link: "/student/dashboard",
    });
  }

  return NextResponse.json(submission);
}
