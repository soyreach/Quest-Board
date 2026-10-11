import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "new_quest", // student: a professor posted a quest
  "certificate_issued", // student: the committee issued a certificate (PDF attached)
  "reward_received", // student: the committee gave a reward
  "gold_ready", // committee: a student reached Gold and can receive a certificate
  "quest_updated", // student: a professor changed a quest they can still work on
  "deadline_soon", // student: a quest they haven't turned in is due within 48h
  "revision_requested", // student: professor asked for changes
  "submission_approved", // student: professor approved and awarded points
  "tier_reached", // student: reached Bronze, Silver or Gold
  "benchmark_reached", // legacy: kept so older notifications still load
  "submission_received", // professor: a student turned in work
];

const NotificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    link: { type: String, default: null }, // where clicking the notification goes
    read: { type: Boolean, default: false },

    // Optional file attached to the notification (the certificate PDF).
    attachment: {
      kind: { type: String, default: null },
      awardId: { type: mongoose.Schema.Types.ObjectId, default: null },
      label: { type: String, default: null },
    },

    // Optional. When set, the same (user, dedupeKey) can only exist once —
    // used so "benchmark reached" and each deadline reminder fire a single time.
    dedupeKey: { type: String, default: null },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index(
  { user: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } }
);

export default mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);
