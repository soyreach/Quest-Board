import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Submission from "@/models/Submission";
import Quest from "@/models/Quest";
import User from "@/models/User";
import { saveUploadedFile } from "@/lib/upload";

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

  let feedbackFileInfo = null;
  if (feedbackFile && typeof feedbackFile.arrayBuffer === "function") {
    feedbackFileInfo = await saveUploadedFile(feedbackFile);
  }

  submission.professorFeedback = professorFeedback;
  if (feedbackFileInfo) {
    submission.professorFeedbackFileUrl = feedbackFileInfo.url;
    submission.professorFeedbackFileName = feedbackFileInfo.name;
  }

  if (action === "approve") {
    submission.status = "Professor_Approved";
    submission.awardedPoints = quest.bountyPoints;
    await submission.save();

    await User.findByIdAndUpdate(submission.student, {
      $inc: { bountyPoints: quest.bountyPoints },
    });
  } else {
    submission.status = "Needs_Revision";
    await submission.save();
  }

  return NextResponse.json(submission);
}
