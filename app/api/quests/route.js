import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Quest from "@/models/Quest";
import { saveUploadedFile } from "@/lib/upload";
import { getBoardQuests, getMyQuests } from "@/lib/queries";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const session = await getServerSession(authOptions);

  if (searchParams.get("mine") === "true") {
    if (!session || session.user.role !== "Professor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(await getMyQuests(session.user.id));
  }

  const quests = await getBoardQuests({
    course: searchParams.get("course"),
    skillTag: searchParams.get("skillTag"),
    difficulty: searchParams.get("difficulty"),
    minPoints: parseInt(searchParams.get("minPoints") || "0", 10),
    userId: session?.user?.id,
    role: session?.user?.role,
  });
  return NextResponse.json(quests);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const rubricRaw = formData.get("rubric");
  const deadlineRaw = formData.get("deadline");
  const attachment = formData.get("attachment");

  let attachmentInfo = null;
  if (attachment && typeof attachment.arrayBuffer === "function") {
    attachmentInfo = await saveUploadedFile(attachment);
  }

  await connectToDatabase();

  const quest = await Quest.create({
    title: formData.get("title"),
    description: formData.get("description"),
    industryContext: formData.get("industryContext") || formData.get("description"),
    syllabusTopic: formData.get("syllabusTopic") || formData.get("title"),
    course: formData.get("course"),
    skillTag: formData.get("skillTag"),
    difficulty: formData.get("difficulty"),
    estimatedHours: Number(formData.get("estimatedHours")),
    bountyPoints: Number(formData.get("bountyPoints")),
    rubric: rubricRaw ? JSON.parse(rubricRaw) : [],
    deadline: deadlineRaw ? new Date(deadlineRaw) : null,
    attachmentUrl: attachmentInfo?.url || null,
    attachmentName: attachmentInfo?.name || null,
    author: session.user.id,
    status: "Active",
  });

  return NextResponse.json(quest, { status: 201 });
}
