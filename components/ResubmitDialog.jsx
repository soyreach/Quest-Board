"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_SUBMISSION_FILES } from "@/lib/constants";
import { filesOf } from "@/lib/submissionFiles";

// Lets a student swap in new files for a quest from their hub, so they don't
// have to go back to the board. Same drag-and-drop box as the board's submit form.
export default function ResubmitDialog({ submission, onClose, onResubmitted }) {
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(false); // lets the modal fade in like the others
  const inputRef = useRef(null);

  const needsRevision = submission.status === "Needs_Revision";
  const currentFiles = filesOf(submission);

  // Adds picked or dropped files, skipping any already in the list.
  function addFiles(list) {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    const key = (f) => `${f.name}-${f.size}-${f.lastModified}`;
    const seen = new Set(files.map(key));
    const merged = [...files, ...incoming.filter((f) => !seen.has(key(f)))];
    setError(merged.length > MAX_SUBMISSION_FILES ? `You can turn in at most ${MAX_SUBMISSION_FILES} files.` : "");
    setFiles(merged.slice(0, MAX_SUBMISSION_FILES));
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function onEscape(e) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [busy, onClose]);

  async function submit() {
    if (!files.length) {
      setError("Choose at least one file to upload first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      for (const f of files) form.append("file", f);
      const res = await fetch(`/api/submissions/${submission._id}/resubmit`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not resubmit. Try again.");
      onResubmitted(data);
    } catch (err) {
      setError(err.message || "Could not resubmit. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className={`modal-backdrop ${shown ? "open" : ""}`} onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resubmit-title"
        className="w-[92vw] max-w-md plain-modal p-8 max-h-[86vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="resubmit-title" className="font-display font-semibold text-xl mb-1">Resubmit your work</h3>
        <p className="text-sm text-[var(--ink)]/70 mb-4">
          {submission.quest?.title}
          {submission.quest?.course ? ` · ${submission.quest.course}` : ""}
        </p>

        {needsRevision && submission.professorFeedback && (
          <div className="rounded-xl bg-[var(--lavender)] p-3 mb-4">
            <div className="text-xs font-medium text-[var(--ink)]/70 mb-1">Your professor asked for changes</div>
            <p className="text-sm italic">&quot;{submission.professorFeedback}&quot;</p>
          </div>
        )}
        {!needsRevision && (
          <p className="text-xs text-[var(--ink)]/70 mb-4">
            Your professor hasn&apos;t reviewed this yet. New files replace the ones they will see.
          </p>
        )}

        {currentFiles.length > 0 && (
          <p className="text-xs text-[var(--ink)]/70 mb-2 break-words">
            Current file{currentFiles.length === 1 ? "" : "s"}: {currentFiles.map((f) => f.name).join(", ")}
          </p>
        )}

        {files.length > 0 && (
          <ul className="space-y-1.5 mb-3">
            {files.map((f) => (
              <li
                key={`${f.name}-${f.size}-${f.lastModified}`}
                className="flex items-center gap-2 rounded-lg border border-[color:var(--line)] bg-white/50 px-3 py-2"
              >
                <span className="text-sm font-medium truncate flex-1 min-w-0">📄 {f.name}</span>
                <button
                  type="button"
                  className="quiet-btn shrink-0 text-xs"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => {
                    setFiles((current) => current.filter((x) => x !== f));
                    setError("");
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {files.length < MAX_SUBMISSION_FILES && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed ${files.length ? "p-3" : "p-6"} text-center cursor-pointer mb-3 transition`}
            style={{
              borderColor: dragOver ? "var(--indigo)" : "rgba(0,0,0,0.15)",
              background: dragOver ? "rgba(117,96,75,0.1)" : "rgba(255,255,255,0.5)",
            }}
          >
            {files.length ? (
              <p className="text-sm font-medium">
                Drag more files here, or <span className="underline" style={{ color: "var(--indigo)" }}>add more</span>
              </p>
            ) : (
              <>
                <p className="text-sm font-medium mb-1">Drag your new files here, or</p>
                <p className="text-sm underline" style={{ color: "var(--indigo)" }}>Choose files to upload</p>
              </>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = ""; // so picking the same file again after removing it still fires
          }}
        />

        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-light btn-sm border border-[color:var(--line)]" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
            {busy ? "Submitting…" : "Resubmit"}
          </button>
        </div>
      </div>
    </div>
  );
}
