import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Notification from "@/models/Notification";
import { syncDeadlineReminders } from "@/lib/notify";

const LIST_LIMIT = 30;

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user;
}

// GET /api/notifications -> { notifications: [...latest 30], unreadCount }
// Everything is scoped to the signed-in user, so nobody can read another
// person's notifications.
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role === "Student") await syncDeadlineReminders(user.id);

  await connectToDatabase();
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: user.id }).sort({ createdAt: -1 }).limit(LIST_LIMIT).lean(),
    Notification.countDocuments({ user: user.id, read: false }),
  ]);

  return NextResponse.json({
    notifications: JSON.parse(JSON.stringify(notifications)),
    unreadCount,
  });
}

// PATCH { ids: [...] }        -> mark those notifications read
// PATCH { all: true }         -> mark everything read
export async function PATCH(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const filter = { user: user.id, read: false };

  if (!body.all) {
    const ids = (Array.isArray(body.ids) ? body.ids : []).filter((id) =>
      mongoose.isValidObjectId(id)
    );
    if (!ids.length) {
      return NextResponse.json({ error: "Provide ids or all: true." }, { status: 400 });
    }
    filter._id = { $in: ids };
  }

  await connectToDatabase();
  const result = await Notification.updateMany(filter, { $set: { read: true } });
  return NextResponse.json({ updated: result.modifiedCount });
}

// DELETE ?id=<id>  -> remove one notification
// DELETE ?all=true -> clear the whole list
export async function DELETE(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter = { user: user.id };

  if (searchParams.get("all") !== "true") {
    const id = searchParams.get("id");
    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Provide a valid id or all=true." }, { status: 400 });
    }
    filter._id = id;
  }

  await connectToDatabase();
  const result = await Notification.deleteMany(filter);
  return NextResponse.json({ deleted: result.deletedCount });
}
