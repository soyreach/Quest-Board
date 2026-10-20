"use client";

import { useEffect, useRef, useState } from "react";

// Lets a student swap in a new file for a quest from their hub, so they don't
// have to go back to the board. Same drag-and-drop box as the board's submit form.
export default function ResubmitDialog({ submission, onClose, onResubmitted }) {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(false); // lets the modal fade in like the others
  const inputRef = useRef(null);

  const needsRevision = submission.status === "Needs_Revision";

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
    if (!file) {
      setError("Choose a file to upload first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
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
            Your professor hasn&apos;t reviewed this yet. A new file replaces the one they will see.
          </p>
        )}

        {submission.fileName && (
          <p className="text-xs text-[var(--ink)]/70 mb-2">Current file: {submission.fileName}</p>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer mb-3 transition"
          style={{
            borderColor: dragOver ? "var(--indigo)" : "rgba(0,0,0,0.15)",
            background: dragOver ? "rgba(117,96,75,0.1)" : "rgba(255,255,255,0.5)",
          }}
        >
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <p className="text-sm font-medium">📄 {file.name}</p>
          ) : (
            <>
              <p className="text-sm font-medium mb-1">Drag your new file here, or</p>
              <p className="text-sm underline" style={{ color: "var(--indigo)" }}>Choose a file to upload</p>
            </>
          )}
        </div>

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
