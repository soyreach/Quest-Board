import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req) {
  const { username, email, password, role, professorCode } = await req.json();

  if (!username?.trim() || !email?.trim() || !password || !role) {
    return NextResponse.json(
      { error: "Username, email, password, and role are all required." },
      { status: 400 }
    );
  }
  if (!["Student", "Professor"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  // The whole point of this gate: only someone who has the secret code from
  // the professor/instructor can register as a Professor. Everyone else gets
  // told plainly and pointed back to Student — no hinting at what the code is.
  if (role === "Professor") {
    const expected = process.env.PROFESSOR_SECRET_CODE;
    if (!expected || professorCode !== expected) {
      return NextResponse.json(
        {
          error:
            "That verification code is incorrect, so you can't sign up as a Professor. Leave the code blank and select Student instead.",
        },
        { status: 403 }
      );
    }
  }

  await connectToDatabase();

  const existing = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { username: username.trim() }],
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email or username already exists — try signing in instead." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    name: username.trim(),
    username: username.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
  });

  return NextResponse.json({ ok: true });
}
