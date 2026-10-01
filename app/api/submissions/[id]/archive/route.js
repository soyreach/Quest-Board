import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Submission from "@/models/Submission";

// POST { archived: true | false }
// Lets a student tuck a submission away in their Archive tab, or restore it.
// This only changes what the student sees. The submission itself is untouched,
// so the professor's review queue and similarity checks are not affected.
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.archived !== "boolean") {
    return NextResponse.json({ error: "archived must be true or false." }, { status: 400 });
  }

  await connectToDatabase();
  const submission = mongoose.isValidObjectId(params.id)
    ? await Submission.findById(params.id)
    : null;

  // Same answer for "missing" and "not yours" so ids can't be probed.
  if (!submission || submission.student.toString() !== session.user.id) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  if (submission.status === "Professor_Approved") {
    return NextResponse.json(
      { error: "Completed quests stay in your Completed tab and can't be archived." },
      { status: 409 }
    );
  }

  await Submission.updateOne(
    { _id: submission._id },
    { $set: { archivedByStudent: body.archived } },
    { timestamps: false }
  );

  return NextResponse.json({ _id: submission._id, archivedByStudent: body.archived });
}
