import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import ChatThread from "@/models/ChatThread";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectToDatabase();
  const threads = await ChatThread.find({ user: session.user.id })
    .select("title updatedAt createdAt")
    .sort({ updatedAt: -1 })
    .lean();
  return NextResponse.json(threads);
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectToDatabase();
  const thread = await ChatThread.create({ user: session.user.id, title: "New chat", messages: [] });
  return NextResponse.json(thread, { status: 201 });
}
