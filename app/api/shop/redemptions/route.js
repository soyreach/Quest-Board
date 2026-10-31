import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import ShopItem from "@/models/ShopItem";
import Redemption from "@/models/Redemption";
import User from "@/models/User";
import { notifyMany } from "@/lib/notify";

// POST { itemId } Students only: exchanges points for a reward.
//
// The unit of stock and the points are each taken with one conditional update
// ("only if there is one left", "only if the balance covers it"), so two quick
// clicks or two students after the last hoodie can't overspend or oversell. If a
// later step fails, the earlier ones are put back.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "Student") {
    return NextResponse.json({ error: "Only students can exchange points." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (!mongoose.isValidObjectId(body.itemId)) {
    return NextResponse.json({ error: "Reward not found." }, { status: 404 });
  }

  await connectToDatabase();

  const item = await ShopItem.findOneAndUpdate(
    { _id: body.itemId, active: true, stock: { $gt: 0 } },
    { $inc: { stock: -1 } },
    { new: true }
  );
  if (!item) {
    return NextResponse.json({ error: "Sorry, this reward just ran out." }, { status: 409 });
  }
  const putStockBack = () => ShopItem.updateOne({ _id: item._id }, { $inc: { stock: 1 } });

  const student = await User.findOneAndUpdate(
    {
      _id: session.user.id,
      $expr: { $gte: [{ $subtract: ["$bountyPoints", { $ifNull: ["$pointsSpent", 0] }] }, item.pointsCost] },
    },
    { $inc: { pointsSpent: item.pointsCost } },
    { new: true }
  );
  if (!student) {
    await putStockBack();
    return NextResponse.json({ error: "You don't have enough points for this reward." }, { status: 409 });
  }

  let redemption;
  try {
    redemption = await Redemption.create({
      student: student._id,
      item: item._id,
      itemName: item.name,
      pointsCost: item.pointsCost,
    });
  } catch (err) {
    await putStockBack();
    await User.updateOne({ _id: student._id }, { $inc: { pointsSpent: -item.pointsCost } });
    throw err;
  }

  const committeeIds = await User.find({ role: "Committee" }).distinct("_id");
  await notifyMany(committeeIds, {
    type: "exchange_requested",
    title: "Reward to hand over",
    message: `${student.name} exchanged ${item.pointsCost} points for ${item.name}.`,
    link: "/shop",
  });

  return NextResponse.json({ redemption, item, pointsSpent: student.pointsSpent }, { status: 201 });
}
