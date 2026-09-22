import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["Student", "Professor", "Admin", null],
      default: null,
    },
    bountyPoints: { type: Number, default: 0 },
    careerGoals: { type: [String], default: [] }, // e.g. ["Backend Engineer", "Data Analyst"]
    skills: { type: [String], default: [] },
    tierBadge: {
      type: String,
      enum: ["Apprentice", "Journeyman", "Master"],
      default: "Apprentice",
    },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
