import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Quest from "@/models/Quest";
import { saveUploadedFile } from "@/lib/upload";
import { parseBountyPoints } from "@/lib/bounty";
import { describeQuestChanges } from "@/lib/questChanges";
import { notifyQuestUpdated } from "@/lib/notify";

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

  // Remember what students currently see, so we can tell them what changed.
  const before = {
    bountyPoints: quest.bountyPoints,
    deadline: quest.deadline ? new Date(quest.deadline).getTime() : null,
    attachmentUrl: quest.attachmentUrl || null,
  };

  const formData = await req.formData();

  // Validate first so a bad value never leaves a half-saved edit or an orphaned upload.
  if (formData.has("bountyPoints")) {
    const bounty = parseBountyPoints(formData.get("bountyPoints"));
    if (!bounty.ok) {
      return NextResponse.json({ error: bounty.error }, { status: 400 });
    }
    quest.bountyPoints = bounty.value;
  }

  if (formData.has("deadline")) {
    const deadlineRaw = formData.get("deadline");
    quest.deadline = deadlineRaw ? new Date(deadlineRaw) : null;
  }

  const attachment = formData.get("attachment");
  if (attachment && typeof attachment.arrayBuffer === "function") {
    let saved;
    try {
      saved = await saveUploadedFile(attachment);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    quest.attachmentUrl = saved.url;
    quest.attachmentName = saved.name;
  }

  if (formData.has("status")) {
    quest.status = formData.get("status");
  }

  await quest.save();

  const after = {
    bountyPoints: quest.bountyPoints,
    deadline: quest.deadline ? new Date(quest.deadline).getTime() : null,
    attachmentUrl: quest.attachmentUrl || null,
  };
  await notifyQuestUpdated(quest, describeQuestChanges(before, after));

  return NextResponse.json(quest);
}
