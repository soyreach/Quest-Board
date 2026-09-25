import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Submission from "@/models/Submission";
import Quest from "@/models/Quest";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Streams a submission's file (or the professor's feedback file) back with a
// Content-Disposition: attachment header, so it always downloads instead of
// the browser guessing whether to preview it inline. Only the student who
// made the submission or the professor who owns the quest can fetch it.
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const which = searchParams.get("which") === "feedback" ? "feedback" : "submission";

  await connectToDatabase();
  const submission = await Submission.findById(params.id);
  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const quest = await Quest.findById(submission.quest);
  const isOwner = submission.student.toString() === session.user.id;
  const isReviewer = quest && quest.author.toString() === session.user.id;
  if (!isOwner && !isReviewer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fileUrl = which === "feedback" ? submission.professorFeedbackFileUrl : submission.fileUrl;
  const fileName = which === "feedback" ? submission.professorFeedbackFileName : submission.fileName;
  if (!fileUrl) {
    return NextResponse.json({ error: "No file on this submission" }, { status: 404 });
  }

  // fileUrl is always of the form /uploads/<name> (see lib/upload.js) — take
  // just the basename so this can never be tricked into reading outside the
  // upload directory.
  const diskName = path.basename(fileUrl);
  let buffer;
  try {
    buffer = await readFile(path.join(UPLOAD_DIR, diskName));
  } catch {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }

  const safeAsciiName = (fileName || diskName).replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "_");
  const encodedName = encodeURIComponent(fileName || diskName);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodedName}`,
      "Content-Length": String(buffer.length),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
