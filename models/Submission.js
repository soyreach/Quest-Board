import mongoose from "mongoose";

const FileFeedbackSchema = new mongoose.Schema(
  {
    fileName: { type: String },
    analyzed: { type: Boolean, default: true }, // false for files we couldn't read as text
    feedback: { type: String },
  },
  { _id: false }
);

const AIPreCheckSchema = new mongoose.Schema(
  {
    preliminaryScore: { type: Number }, // 0-100
    feedbackSummary: { type: String }, // on the submission as a whole
    // A separate comment on each file, in upload order.
    fileFeedback: { type: [FileFeedbackSchema], default: undefined },
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

const FileSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String, default: null },
  },
  { _id: false }
);

// One entry per turn-in or review, oldest first. See lib/submissionHistory.js.
const HistoryEventSchema = new mongoose.Schema({
  type: { type: String, enum: ["submitted", "resubmitted", "revision_requested", "approved"], required: true },
  at: { type: Date, default: Date.now },
  fileUrl: { type: String, default: null }, // the student's first file at that turn-in
  fileName: { type: String, default: null },
  files: { type: [FileSchema], default: undefined }, // every file at that turn-in
  note: { type: String, default: "" }, // the professor's comment on a review
  feedbackFileUrl: { type: String, default: null },
  feedbackFileName: { type: String, default: null },
  points: { type: Number, default: 0 },
});

const SubmissionSchema = new mongoose.Schema(
  {
    quest: { type: mongoose.Schema.Types.ObjectId, ref: "Quest", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    repoLink: { type: String }, // optional, kept for backward compatibility
    writtenWork: { type: String }, // optional, kept for backward compatibility
    fileUrl: { type: String, default: null }, // the student's first uploaded file
    fileName: { type: String, default: null },
    // Every uploaded file, fileUrl/fileName included. Older submissions only
    // have fileUrl/fileName — read through filesOf() in lib/submissionFiles.js.
    files: { type: [FileSchema], default: undefined },

    status: {
      type: String,
      enum: ["Submitted", "AI_PreChecked", "Professor_Approved", "Needs_Revision"],
      default: "Submitted",
    },

    aiPreCheck: { type: AIPreCheckSchema, default: null },

    // The student moved this to their Archive tab. Only hides it from their
    // In progress list; the professor's queue never looks at this.
    archivedByStudent: { type: Boolean, default: false },

    awardedPoints: { type: Number, default: 0 },
    professorFeedback: { type: String },
    professorFeedbackFileUrl: { type: String, default: null }, // e.g. an annotated file sent back
    professorFeedbackFileName: { type: String, default: null },

    history: { type: [HistoryEventSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.Submission ||
  mongoose.model("Submission", SubmissionSchema);
