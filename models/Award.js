import mongoose from "mongoose";

// Something the school committee gives a student: a certificate (one per
// student, with an optional gift) or a stand-alone reward.
const AwardSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["certificate", "reward"], required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Certificate fields. What is printed on the PDF is stored here, so the
    // certificate never changes if an account is renamed later.
    recipientName: { type: String, default: "" },
    signerName: { type: String, default: "" },
    signerTitle: { type: String, default: "School Committee" },
    certId: { type: String, default: null },
    tier: { type: String, default: "" },
    points: { type: Number, default: 0 },

    // The gift (certificate) or the reward itself (reward).
    reward: { type: String, default: "" },
    note: { type: String, default: "" },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// A student can only ever hold one certificate; certificate ids are unique.
AwardSchema.index(
  { student: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: "certificate" } }
);
AwardSchema.index({ certId: 1 }, { unique: true, partialFilterExpression: { certId: { $type: "string" } } });

export default mongoose.models.Award || mongoose.model("Award", AwardSchema);
