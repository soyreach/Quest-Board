import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Submission from "@/models/Submission";
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

  const saved = await saveUploadedFile(file);

  await connectToDatabase();
  const submission = await Submission.create({
    quest: questId,
    student: session.user.id,
    fileUrl: saved.url,
    fileName: saved.name,
    status: "Submitted",
  });

  return NextResponse.json(submission, { status: 201 });
}
