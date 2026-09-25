"use client";

import { useState } from "react";

function formatDeadline(deadline) {
  if (!deadline) return null;
  return new Date(deadline).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ProfessorDashboardClient({ initialQuests, initialQueue }) {
  const [quests, setQuests] = useState(initialQuests);
  const [queue, setQueue] = useState(initialQueue);

  // Create-quest modal state
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [syllabusText, setSyllabusText] = useState("");
  const [converting, setConverting] = useState(false);
  const [draft, setDraft] = useState(null);
  const [convertError, setConvertError] = useState("");
  const [pinning, setPinning] = useState(false);
  const [newDeadline, setNewDeadline] = useState("");
  const [newAttachment, setNewAttachment] = useState(null);

  // Edit-quest modal state
  const [editingQuest, setEditingQuest] = useState(null);
  const [editDeadline, setEditDeadline] = useState("");
  const [editAttachment, setEditAttachment] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Per-submission comment/feedback-file state, keyed by submission id
  const [reviewNotes, setReviewNotes] = useState({});
  const [reviewFiles, setReviewFiles] = useState({});

  // Used after mutations (pin/edit/review/pre-check) to pull the fresh
  // state back in — the INITIAL load no longer needs this, since the server
  // component already fetched it before the page ever reached the browser.
  async function loadAll() {
    const [qRes, sRes] = await Promise.all([
      fetch("/api/quests?mine=true"),
      fetch("/api/submissions"),
    ]);
    setQuests(await qRes.json());
    setQueue(await sRes.json());
  }

  async function convertSyllabus() {
    setConverting(true);
    setConvertError("");
    const res = await fetch("/api/ai/convert-syllabus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syllabusText }),
    });
    setConverting(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setConvertError(error || "Conversion failed — try adding more detail to the syllabus text.");
      return;
    }
    setDraft(await res.json());
  }

  async function pinQuest() {
    if (!draft) return;
    setPinning(true);

    const form = new FormData();
    Object.entries(draft).forEach(([key, value]) => {
      if (key === "rubric") form.append("rubric", JSON.stringify(value || []));
      else form.append(key, value);
    });
    if (newDeadline) form.append("deadline", newDeadline);
    if (newAttachment) form.append("attachment", newAttachment);

    const res = await fetch("/api/quests", { method: "POST", body: form });
    setPinning(false);
    if (res.ok) {
      setCreatorOpen(false);
      setDraft(null);
      setSyllabusText("");
      setNewDeadline("");
      setNewAttachment(null);
      loadAll();
    }
  }

  function openEdit(quest) {
    setEditingQuest(quest);
    setEditDeadline(quest.deadline ? new Date(quest.deadline).toISOString().slice(0, 10) : "");
    setEditAttachment(null);
  }

  async function saveEdit() {
    if (!editingQuest) return;
    setSavingEdit(true);

    const form = new FormData();
    form.append("deadline", editDeadline); // empty string clears the deadline
    if (editAttachment) form.append("attachment", editAttachment);

    const res = await fetch(`/api/quests/${editingQuest._id}`, { method: "PATCH", body: form });
    setSavingEdit(false);
    if (res.ok) {
      setEditingQuest(null);
      loadAll();
    }
  }

  async function reviewAction(id, action) {
    const form = new FormData();
    form.append("action", action);
    form.append("professorFeedback", reviewNotes[id] || "");
    if (reviewFiles[id]) form.append("feedbackFile", reviewFiles[id]);

    await fetch(`/api/submissions/${id}`, { method: "PATCH", body: form });
    setQueue((q) => q.filter((s) => s._id !== id));
  }

  async function preCheck(id) {
    await fetch("/api/ai/pre-grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: id }),
    });
    loadAll();
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-10 pb-24 page-enter">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-bold text-3xl mb-1">Faculty hub</h1>
          <p className="text-[var(--ink)]/55 text-sm">Post quests, manage what&apos;s live, and review incoming submissions.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreatorOpen(true)}>+ Add new quest</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-10">
        <div className="bg-white rounded-3xl p-5 shadow-[0_10px_30px_-20px_rgba(20,18,43,0.4)]">
          <div className="text-xs text-[var(--ink)]/45 mb-1">Posted this term</div>
          <div className="font-display font-bold text-2xl">{quests.length} quests</div>
        </div>
        <div className="bg-white rounded-3xl p-5 shadow-[0_10px_30px_-20px_rgba(20,18,43,0.4)]">
          <div className="text-xs text-[var(--ink)]/45 mb-1">Pending review</div>
          <div className="font-display font-bold text-2xl">{queue.length} submissions</div>
        </div>
        <div className="bg-white rounded-3xl p-5 shadow-[0_10px_30px_-20px_rgba(20,18,43,0.4)]">
          <div className="text-xs text-[var(--ink)]/45 mb-1">Points awarded</div>
          <div className="font-display font-bold text-2xl">
            {quests.reduce((sum, q) => sum + (q.bountyPoints || 0), 0)} pts posted
          </div>
        </div>
      </div>

      <h2 className="font-display font-semibold text-xl mb-4">Posted quests</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {quests.length === 0 && <p className="text-sm text-[var(--ink)]/50">No quests posted yet — add your first one above.</p>}
        {quests.map((q) => {
          const expired = q.deadline && new Date(q.deadline) < new Date();
          return (
            <div key={q._id} className="p-5 rounded-2xl bg-white border border-black/5">
              <div className="flex justify-between mb-2">
                <span className="badge bg-[var(--indigo-soft)] text-[var(--violet-2)]">{q.status}</span>
                <span className="text-xs font-semibold" style={{ color: "var(--gold)" }}>+{q.bountyPoints} pts</span>
              </div>
              <div className="font-medium mb-1">{q.title}</div>
              <div className="text-xs text-[var(--ink)]/50 mb-3">{q.course}</div>
              <div className="flex items-center justify-between">
                <div className="text-xs">
                  {q.deadline ? (
                    <span className={expired ? "text-red-600 font-medium" : "text-[var(--ink)]/50"}>
                      {expired ? "Expired " : "Due "}{formatDeadline(q.deadline)}
                    </span>
                  ) : (
                    <span className="text-[var(--ink)]/35">No deadline</span>
                  )}
                </div>
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(q)}>Edit</button>
              </div>
              {q.attachmentUrl && (
                <a href={q.attachmentUrl} target="_blank" rel="noreferrer" className="text-xs underline mt-2 inline-block text-[var(--indigo)]">
                  📎 {q.attachmentName}
                </a>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="font-display font-semibold text-xl mb-4">Submission review queue</h2>
      <div className="space-y-4">
        {queue.length === 0 && <p className="text-sm text-[var(--ink)]/50">Nothing waiting on you right now.</p>}
        {queue.map((s) => (
          <div key={s._id} className="bg-white rounded-2xl p-5 border border-black/5">
            <div className="flex flex-wrap justify-between gap-3 mb-3">
              <div>
                <div className="font-medium">{s.student?.name} — {s.quest?.title}</div>
                {s.fileUrl ? (
                  <a href={`/api/submissions/${s._id}/download`} className="text-xs underline text-[var(--indigo)]">
                    📄 {s.fileName || "Download submitted file"}
                  </a>
                ) : (
                  <div className="text-xs text-[var(--ink)]/50">{s.repoLink}</div>
                )}
              </div>
              <span className="badge bg-amber-50 text-amber-700">{s.status.replace("_", " ")}</span>
            </div>

            {s.aiPreCheck ? (
              s.aiPreCheck.textAnalyzed ? (
                <div className="mb-4">
                  <div className="grid sm:grid-cols-3 gap-3 mb-3 text-sm">
                    <div className="bg-[var(--lavender)] rounded-xl p-3">
                      <div className="text-xs text-[var(--ink)]/45 mb-1">Preliminary score</div>
                      <div className="font-semibold">{s.aiPreCheck.preliminaryScore} / 100</div>
                    </div>
                    <div className="bg-[var(--lavender)] rounded-xl p-3">
                      <div className="text-xs text-[var(--ink)]/45 mb-1">Similarity (computed)</div>
                      <div className="font-semibold">
                        {s.aiPreCheck.similarityScore}%
                        {s.aiPreCheck.similarityMatchStudentName && (
                          <span className="font-normal text-[var(--ink)]/50"> · vs {s.aiPreCheck.similarityMatchStudentName}</span>
                        )}
                      </div>
                    </div>
                    <div className="bg-[var(--lavender)] rounded-xl p-3">
                      <div className="text-xs text-[var(--ink)]/45 mb-1">Flags</div>
                      <div className="font-semibold">{s.aiPreCheck.flagCount}</div>
                    </div>
                  </div>

                  {s.aiPreCheck.feedbackSummary && (
                    <div className="bg-white border border-black/5 rounded-xl p-3 text-sm mb-3">
                      <div className="text-xs font-semibold text-[var(--ink)]/45 mb-1">AI feedback</div>
                      {s.aiPreCheck.feedbackSummary}
                    </div>
                  )}

                  {s.aiPreCheck.aiLikelihoodScore != null && (
                    <div className="bg-amber-50 rounded-xl p-3 text-sm">
                      <div className="text-xs font-semibold text-amber-800 mb-1">
                        AI-content likelihood (heuristic): {s.aiPreCheck.aiLikelihoodScore}%
                      </div>
                      <p className="text-xs text-amber-800/80">{s.aiPreCheck.aiLikelihoodNote}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[var(--lavender)] rounded-xl p-3 text-sm mb-4">
                  {s.aiPreCheck.feedbackSummary}
                </div>
              )
            ) : (
              <button className="btn btn-sm btn-outline mb-4" onClick={() => preCheck(s._id)}>✨ Run AI pre-check</button>
            )}

            <textarea
              rows={2}
              placeholder="Comment for the student…"
              value={reviewNotes[s._id] || ""}
              onChange={(e) => setReviewNotes((n) => ({ ...n, [s._id]: e.target.value }))}
              className="w-full rounded-xl border border-black/10 p-3 text-sm mb-2"
            />
            <label className="flex items-center gap-2 text-xs text-[var(--ink)]/55 mb-4 cursor-pointer">
              <span className="btn btn-sm btn-outline">Attach a file back</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setReviewFiles((f) => ({ ...f, [s._id]: e.target.files?.[0] || null }))}
              />
              {reviewFiles[s._id]?.name && <span>{reviewFiles[s._id].name}</span>}
            </label>

            <div className="flex gap-3">
              <button className="btn btn-sm btn-primary" onClick={() => reviewAction(s._id, "approve")}>Approve &amp; award points</button>
              <button className="btn btn-sm btn-outline" onClick={() => reviewAction(s._id, "revise")}>Request revision</button>
            </div>
          </div>
        ))}
      </div>

      {/* Create quest modal */}
      <div className={`modal-backdrop ${creatorOpen ? "open" : ""}`} onClick={() => setCreatorOpen(false)}>
        {creatorOpen && (
          <div className="w-[92vw] max-w-xl plain-modal p-8 max-h-[86vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-xl mb-1">Add a new quest</h3>
            <p className="text-sm text-[var(--ink)]/55 mb-5">Paste a syllabus excerpt and let AI draft the quest — then edit before you pin it.</p>
            <textarea
              rows={4}
              value={syllabusText}
              onChange={(e) => setSyllabusText(e.target.value)}
              placeholder="Paste raw syllabus text here…"
              className="w-full rounded-2xl border border-black/10 p-4 text-sm mb-3"
            />
            {convertError && <p className="text-xs text-red-600 mb-2">{convertError}</p>}
            <button className="btn btn-sm btn-outline mb-6" onClick={convertSyllabus} disabled={converting || syllabusText.trim().length < 20}>
              {converting ? "Converting…" : "✨ Convert with AI"}
            </button>

            {draft && (
              <div className="space-y-3">
                <input className="w-full rounded-xl border border-black/10 p-3 text-sm" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                <textarea rows={3} className="w-full rounded-xl border border-black/10 p-3 text-sm" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                <div className="grid grid-cols-3 gap-3">
                  <select className="rounded-xl border border-black/10 p-3 text-sm" value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}>
                    <option>Apprentice</option><option>Journeyman</option><option>Master</option>
                  </select>
                  <input className="rounded-xl border border-black/10 p-3 text-sm" value={draft.estimatedHours} onChange={(e) => setDraft({ ...draft, estimatedHours: Number(e.target.value) })} />
                  <input className="rounded-xl border border-black/10 p-3 text-sm" value={`${draft.bountyPoints} pts`} readOnly />
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--ink)]/60 mb-1 block">Deadline (optional)</label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full rounded-xl border border-black/10 p-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--ink)]/60 mb-1 block">Attach a rubric file or image (optional)</label>
                  <input
                    type="file"
                    onChange={(e) => setNewAttachment(e.target.files?.[0] || null)}
                    className="w-full text-sm"
                  />
                </div>

                <button className="btn btn-primary w-full" onClick={pinQuest} disabled={pinning}>
                  {pinning ? "Pinning…" : "📌 Pin to board"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit quest modal */}
      <div className={`modal-backdrop ${editingQuest ? "open" : ""}`} onClick={() => setEditingQuest(null)}>
        {editingQuest && (
          <div className="w-[92vw] max-w-md plain-modal p-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-xl mb-1">Edit &quot;{editingQuest.title}&quot;</h3>
            <p className="text-sm text-[var(--ink)]/55 mb-5">Update the deadline or swap the attached file.</p>

            <label className="text-xs font-medium text-[var(--ink)]/60 mb-1 block">Deadline</label>
            <input
              type="date"
              value={editDeadline}
              onChange={(e) => setEditDeadline(e.target.value)}
              className="w-full rounded-xl border border-black/10 p-3 text-sm mb-3"
            />
            <p className="text-xs text-[var(--ink)]/40 mb-4">Leave blank and save to remove the deadline entirely.</p>

            <label className="text-xs font-medium text-[var(--ink)]/60 mb-1 block">Replace attached file</label>
            <input
              type="file"
              onChange={(e) => setEditAttachment(e.target.files?.[0] || null)}
              className="w-full text-sm mb-6"
            />

            <button className="btn btn-primary w-full" onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
