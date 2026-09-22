import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import ChatThread from "@/models/ChatThread";

async function getOwnedThread(id, userId) {
  const thread = await ChatThread.findById(id);
  if (!thread || thread.user.toString() !== userId) return null;
  return thread;
}

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectToDatabase();
  const thread = await getOwnedThread(params.id, session.user.id);
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(thread);
}

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { messages } = await req.json();

  await connectToDatabase();
  const thread = await getOwnedThread(params.id, session.user.id);
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  thread.messages = (messages || []).map((m) => ({ role: m.role, content: m.content }));

  // Auto-title a fresh thread from the first thing the student actually asked.
  if (thread.title === "New chat") {
    const firstUserMessage = thread.messages.find((m) => m.role === "user");
    if (firstUserMessage) {
      thread.title = firstUserMessage.content.slice(0, 48) + (firstUserMessage.content.length > 48 ? "…" : "");
    }
  }

  await thread.save();
  return NextResponse.json(thread);
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectToDatabase();
  const thread = await getOwnedThread(params.id, session.user.id);
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await thread.deleteOne();
  return NextResponse.json({ ok: true });
}
