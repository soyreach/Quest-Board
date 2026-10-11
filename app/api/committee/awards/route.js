import { NextResponse } from "next/server";
import mongoose from "mongoose";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Award from "@/models/Award";
import User from "@/models/User";
import { notifyUser } from "@/lib/notify";
import { MAX_TIER_POINTS } from "@/lib/tiers";

// POST { type: "certificate" | "reward", studentId, recipientName?, reward?, note? }
// Committee only. A certificate needs the student to have reached Gold.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Committee") {
    return NextResponse.json({ error: "Only the school committee can do this." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const type = body.type;
  const reward = String(body.reward ?? "").trim();
  const note = String(body.note ?? "").trim();

  if (!["certificate", "reward"].includes(type)) {
    return NextResponse.json({ error: "Choose certificate or reward." }, { status: 400 });
  }
  if (!mongoose.isValidObjectId(body.studentId)) {
    return NextResponse.json({ error: "Pick a student." }, { status: 400 });
  }
  if (reward.length > 120 || note.length > 500) {
    return NextResponse.json({ error: "Reward (120 characters) or note (500) is too long." }, { status: 400 });
  }

  await connectToDatabase();
  const student = await User.findById(body.studentId);
  if (!student || student.role !== "Student") {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }
  const committee = await User.findById(session.user.id).select("name").lean();

  if (type === "reward") {
    if (!reward) {
      return NextResponse.json({ error: "Describe the reward you are giving." }, { status: 400 });
    }
    const award = await Award.create({
      type: "reward",
      student: student._id,
      issuedBy: session.user.id,
      reward,
      note,
      points: student.bountyPoints,
    });
    await notifyUser(student._id, {
      type: "reward_received",
      title: "You received a reward",
      message: `The school committee awarded you: ${reward}.${note ? ` "${note.length > 100 ? note.slice(0, 97) + "…" : note}"` : ""}`,
      link: "/student/dashboard",
      dedupeKey: `award:${award._id}`,
    });
    return NextResponse.json(JSON.parse(JSON.stringify(award)), { status: 201 });
  }

  // ---- certificate ----
  if (student.bountyPoints < MAX_TIER_POINTS) {
    return NextResponse.json(
      { error: `${student.name} hasn't reached Gold (${MAX_TIER_POINTS} points) yet.` },
      { status: 409 }
    );
  }
  if (await Award.exists({ student: student._id, type: "certificate" })) {
    return NextResponse.json({ error: "This student already has a certificate." }, { status: 409 });
  }

  const recipientName = String(body.recipientName ?? "").trim() || student.name;
  if (recipientName.length > 80) {
    return NextResponse.json({ error: "The name on the certificate is too long (80 characters)." }, { status: 400 });
  }

  let award = null;
  for (let attempt = 0; attempt < 4 && !award; attempt++) {
    const certId = `QB-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    try {
      award = await Award.create({
        type: "certificate",
        student: student._id,
        issuedBy: session.user.id,
        recipientName,
        signerName: committee?.name || session.user.name || "School Committee",
        signerTitle: "School Committee",
        certId,
        tier: "Gold",
        points: student.bountyPoints,
        reward,
        note,
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      if (await Award.exists({ student: student._id, type: "certificate" })) {
        return NextResponse.json({ error: "This student already has a certificate." }, { status: 409 });
      }
      // otherwise the random certificate id collided: loop and try another
    }
  }
  if (!award) {
    return NextResponse.json({ error: "Could not issue the certificate. Try again." }, { status: 500 });
  }

  await notifyUser(student._id, {
    type: "certificate_issued",
    title: "Your certificate is ready",
    message: `The school committee issued your Certificate of Appreciation (${award.certId}).${
      reward ? ` Your reward: ${reward}.` : ""
    }`,
    link: "/student/dashboard",
    dedupeKey: `award:${award._id}`,
    attachment: { kind: "certificate", awardId: award._id, label: "Certificate (PDF)" },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(award)), { status: 201 });
}
