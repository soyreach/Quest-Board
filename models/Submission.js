import mongoose from "mongoose";

const AIPreCheckSchema = new mongoose.Schema(
  {
    preliminaryScore: { type: Number }, // 0-100
    feedbackSummary: { type: String },
    flagCount: { type: Number, default: 0 },

    textAnalyzed: { type: Boolean, default: false }, // false for file types we can't read as text (zip, images, etc.)

    // Real, computed similarity against this quest's other submissions —
    // not an LLM guess. See lib/similarity.js.
    similarityScore: { type: Number, default: null }, // 0-100
    similarityMatchStudentName: { type: String, default: null }, // whose submission it most resembles

    // A Gemini heuristic guess at whether the text reads as AI-generated.
    // Explicitly NOT a certified detector (see UI/README caveats) — LLM
    // self-assessment of possibly-LLM text is inherently unreliable.
    aiLikelihoodScore: { type: Number, default: null }, // 0-100
    aiLikelihoodNote: { type: String, default: null },
  },
  { _id: false }
);

const SubmissionSchema = new mongoose.Schema(
  {
    quest: { type: mongoose.Schema.Types.ObjectId, ref: "Quest", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    repoLink: { type: String }, // optional, kept for backward compatibility
    writtenWork: { type: String }, // optional, kept for backward compatibility
    fileUrl: { type: String, default: null }, // the student's uploaded file
    fileName: { type: String, default: null },

    status: {
      type: String,
      enum: ["Submitted", "AI_PreChecked", "Professor_Approved", "Needs_Revision"],
      default: "Submitted",
    },

    aiPreCheck: { type: AIPreCheckSchema, default: null },

    awardedPoints: { type: Number, default: 0 },
    professorFeedback: { type: String },
    professorFeedbackFileUrl: { type: String, default: null }, // e.g. an annotated file sent back
    professorFeedbackFileName: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Submission ||
  mongoose.model("Submission", SubmissionSchema);
