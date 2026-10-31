import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import ShopItem from "@/models/ShopItem";
import Redemption from "@/models/Redemption";
import User from "@/models/User";
import { notifyUser } from "@/lib/notify";

const NEXT_STATUS = { collect: "Collected", cancel: "Cancelled" };

// PATCH { action: "collect" | "cancel" } Committee only. Moving the request out
// of Pending is one conditional update, so a refund can only ever happen once.
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Committee") {
    return NextResponse.json({ error: "Only the school committee can do this." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const status = Object.hasOwn(NEXT_STATUS, body.action) ? NEXT_STATUS[body.action] : null;
  if (!status) {
    return NextResponse.json({ error: "Choose collect or cancel." }, { status: 400 });
  }
  if (!mongoose.isValidObjectId(params.id)) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  await connectToDatabase();
  const redemption = await Redemption.findOneAndUpdate(
    { _id: params.id, status: "Pending" },
    { status, handledBy: session.user.id, handledAt: new Date() },
    { new: true }
  ).populate("student", "name username email");
  if (!redemption) {
    return NextResponse.json({ error: "This request has already been dealt with." }, { status: 409 });
  }

  let item = null;
  if (status === "Cancelled") {
    await User.updateOne({ _id: redemption.student._id }, { $inc: { pointsSpent: -redemption.pointsCost } });
    item = await ShopItem.findByIdAndUpdate(redemption.item, { $inc: { stock: 1 } }, { new: true });
  }

  await notifyUser(redemption.student._id, {
    type: "exchange_updated",
    title: status === "Collected" ? "Reward handed over" : "Exchange cancelled",
    message:
      status === "Collected"
        ? `You collected ${redemption.itemName}. Enjoy it!`
        : `The school committee cancelled your exchange for ${redemption.itemName}. Your ${redemption.pointsCost} points are back.`,
    link: "/shop",
  });

  return NextResponse.json({ redemption, item });
}
