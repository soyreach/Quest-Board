import mongoose from "mongoose";

const RubricItemSchema = new mongoose.Schema(
  {
    criterion: { type: String, required: true },
    weightPoints: { type: Number, required: true },
    automatedCheckable: { type: Boolean, default: false },
  },
  { _id: false }
);

const QuestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true }, // RPG-style flavor text
    industryContext: { type: String, required: true }, // why this matters in the real world
    syllabusTopic: { type: String, required: true },
    course: { type: String, required: true }, // e.g. "CS301"
    skillTag: { type: String, required: true }, // e.g. "Backend", "Data analysis"

    difficulty: {
      type: String,
      enum: ["Apprentice", "Journeyman", "Master"],
      required: true,
    },
    estimatedHours: { type: Number, required: true },
    bountyPoints: { type: Number, required: true }, // estimatedHours * 25 * tierMultiplier

    rubric: { type: [RubricItemSchema], default: [] },

    deadline: { type: Date, default: null }, // past this date, the quest is hidden from the board
    attachmentUrl: { type: String, default: null }, // e.g. a rubric file or reference image
    attachmentName: { type: String, default: null },

    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["Draft", "Active", "Archived"],
      default: "Draft",
    },
  },
  { timestamps: true }
);

export default mongoose.models.Quest || mongoose.model("Quest", QuestSchema);
