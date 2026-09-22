import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
  },
  { _id: false, timestamps: true }
);

const ChatThreadSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "New chat" },
    messages: { type: [ChatMessageSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.ChatThread || mongoose.model("ChatThread", ChatThreadSchema);
