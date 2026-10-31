import mongoose from "mongoose";

// A reward the school committee has put in the exchange shop. Items are hidden
// rather than deleted, so a request that is still waiting keeps its reward.
const ShopItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    pointsCost: { type: Number, required: true, min: 1 },
    stock: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, default: null },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.ShopItem || mongoose.model("ShopItem", ShopItemSchema);
