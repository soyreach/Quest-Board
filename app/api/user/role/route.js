import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role } = await req.json();
  if (!["Student", "Professor"].includes(role)) {
    return NextResponse.json({ error: "role must be Student or Professor" }, { status: 400 });
  }

  await connectToDatabase();
  await User.findByIdAndUpdate(session.user.id, { role });

  return NextResponse.json({ ok: true, role });
}
