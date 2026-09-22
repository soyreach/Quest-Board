import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Quest from "@/models/Quest";
import { saveUploadedFile } from "@/lib/upload";

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const quest = await Quest.findById(params.id);
  if (!quest || quest.author.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();

  if (formData.has("deadline")) {
    const deadlineRaw = formData.get("deadline");
    quest.deadline = deadlineRaw ? new Date(deadlineRaw) : null;
  }

  const attachment = formData.get("attachment");
  if (attachment && typeof attachment.arrayBuffer === "function") {
    const saved = await saveUploadedFile(attachment);
    quest.attachmentUrl = saved.url;
    quest.attachmentName = saved.name;
  }

  if (formData.has("status")) {
    quest.status = formData.get("status");
  }

  await quest.save();
  return NextResponse.json(quest);
}
