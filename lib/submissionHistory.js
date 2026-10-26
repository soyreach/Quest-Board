// Every turn-in and review on a submission is appended to its `history`, so the
// student hub can show a quest's whole back-and-forth in one place even though
// resubmitting replaces the file on the submission itself.

// `files` is one saved file or a list of them (see lib/upload.js).
export function submittedEvent(type, files) {
  const list = Array.isArray(files) ? files : [files];
  return { type, at: new Date(), fileUrl: list[0].url, fileName: list[0].name, files: list };
}

export function reviewEvent(action, { note, feedbackFile, points }) {
  return {
    type: action === "approve" ? "approved" : "revision_requested",
    at: new Date(),
    note: note || "",
    feedbackFileUrl: feedbackFile?.url || null,
    feedbackFileName: feedbackFile?.name || null,
    points: action === "approve" ? points : 0,
  };
}

// Submissions made before history was recorded have none. The first time one
// gets a new event, snapshot what it already shows so that state isn't lost.
export function seedHistory(submission) {
  if (submission.history?.length) return [];
  const seed = [];
  if (submission.fileUrl) {
    seed.push({ type: "submitted", at: submission.createdAt, fileUrl: submission.fileUrl, fileName: submission.fileName });
  }
  if (submission.status === "Needs_Revision") {
    seed.push({
      type: "revision_requested",
      at: submission.updatedAt,
      note: submission.professorFeedback || "",
      feedbackFileUrl: submission.professorFeedbackFileUrl || null,
      feedbackFileName: submission.professorFeedbackFileName || null,
    });
  }
  return seed;
}
