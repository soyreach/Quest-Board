import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

// Each non-student role is gated by its own secret code from .env.local.
const ROLE_CODES = {
  Professor: { env: "PROFESSOR_SECRET_CODE", label: "Professor" },
  Committee: { env: "COMMITTEE_SECRET_CODE", label: "School Committee" },
};

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,30}$/;

export async function POST(req) {
  const body = await req.json();
  const { username, email, password, role } = body;
  const fullName = String(body.fullName ?? "").trim();
  // professorCode is the older field name; roleCode covers every gated role.
  const roleCode = body.roleCode ?? body.professorCode;

  if (!username?.trim() || !email?.trim() || !password || !role) {
    return NextResponse.json(
      { error: "Username, email, password, and role are all required." },
      { status: 400 }
    );
  }
  if (!["Student", "Professor", "Committee"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  if (!USERNAME_PATTERN.test(username.trim())) {
    return NextResponse.json(
      { error: "Username must be 3–30 characters: letters, numbers, dots, dashes or underscores (no spaces or @)." },
      { status: 400 }
    );
  }
  if (fullName && (fullName.length < 2 || fullName.length > 80)) {
    return NextResponse.json({ error: "Full name must be 2–80 characters." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  // The whole point of this gate: only someone who has the secret code can
  // register for a gated role. Everyone else gets told plainly and pointed
  // back to Student — no hinting at what the code is.
  if (ROLE_CODES[role]) {
    const expected = process.env[ROLE_CODES[role].env];
    if (!expected || roleCode !== expected) {
      return NextResponse.json(
        {
          error: `That verification code is incorrect, so you can't sign up as ${ROLE_CODES[role].label}. Leave the code blank and select Student instead.`,
        },
        { status: 403 }
      );
    }
  }

  await connectToDatabase();

  const cleanUsername = username.trim();
  const escaped = cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = await User.findOne({
    $or: [{ email: email.toLowerCase().trim() }, { username: new RegExp(`^${escaped}$`, "i") }],
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email or username already exists — try signing in instead." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    // `name` is the full name printed on certificates; `username` is the sign-in handle.
    name: fullName || cleanUsername,
    username: cleanUsername,
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
  });

  return NextResponse.json({ ok: true });
}
