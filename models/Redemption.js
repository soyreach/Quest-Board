import mongoose from "mongoose";

// A student exchanging points for a shop reward. The points leave the student's
// balance straight away; the committee then hands the reward over, or cancels
// the request and the points go back.
const RedemptionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: "ShopItem", required: true },

    // Saved at exchange time, so a later edit to the item can't change what the
    // student paid or what a refund gives back.
    itemName: { type: String, required: true },
    pointsCost: { type: Number, required: true },

    status: { type: String, enum: ["Pending", "Collected", "Cancelled"], default: "Pending" },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Redemption || mongoose.model("Redemption", RedemptionSchema);
