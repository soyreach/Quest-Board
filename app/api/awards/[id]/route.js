import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Award from "@/models/Award";

// GET /api/awards/<id> -> what's needed to print the certificate PDF.
// Only the student it was issued to, or a committee member, can read it.
export async function GET(_req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();
  const award = mongoose.isValidObjectId(params.id) ? await Award.findById(params.id).lean() : null;
  const allowed =
    award && (session.user.role === "Committee" || String(award.student) === session.user.id);
  if (!allowed || award.type !== "certificate") {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }

  return NextResponse.json({
    recipientName: award.recipientName,
    signerName: award.signerName,
    signerTitle: award.signerTitle,
    certId: award.certId,
    issuedAt: award.issuedAt,
  });
}
