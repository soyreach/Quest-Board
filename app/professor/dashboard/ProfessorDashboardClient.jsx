"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, FileText, Paperclip, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { MIN_BOUNTY_POINTS, MAX_BOUNTY_POINTS } from "@/lib/constants";
import { filesOf } from "@/lib/submissionFiles";

// Textarea that grows to fit its content, so long AI-written instructions
// can be read and edited without scrolling inside a tiny box.
function AutoGrowTextarea({ value, minRows = 3, className = "", ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} rows={minRows} value={value} className={`${className} resize-none overflow-hidden`} {...props} />;
}

let rubricKeySeq = 0;
const withRubricKeys = (rubric) => (rubric || []).map((r) => ({ ...r, _key: ++rubricKeySeq }));

function formatDeadline(deadline) {
  if (!deadline) return null;
  return new Date(deadline).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// "Expired" = has a deadline that's already passed. Everything else
// (no deadline, or a deadline still in the future) counts as "posted".
function isExpired(quest) {
  return Boolean(quest.deadline) && new Date(quest.deadline) < new Date();
}

// Returns an error message for an invalid bounty, or "" when it is fine.
// The server checks again; this just saves the professor a round trip.
function validateBounty(raw) {
  const text = String(raw ?? "").trim();
  const n = Number(text);
  if (text === "" || !Number.isInteger(n)) return "Enter the bounty as a whole number of points.";
  if (n < MIN_BOUNTY_POINTS || n > MAX_BOUNTY_POINTS) {
    return `Bounty must be between ${MIN_BOUNTY_POINTS} and ${MAX_BOUNTY_POINTS} points.`;
  }
  return "";
}

const QUEST_FILTERS = [
  { key: "all", label: "All" },
  { key: "posted", label: "Posted" },
  { key: "expired", label: "Expired" },
];

export default function ProfessorDashboardClient({ initialQuests, initialQueue }) {
  const [quests, setQuests] = useState(initialQuests);
  const [queue, setQueue] = useState(initialQueue);
  const [questFilter, setQuestFilter] = useState("all"); // "all" | "posted" | "expired"

  // Create-quest modal state
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [syllabusText, setSyllabusText] = useState("");
  const [converting, setConverting] = useState(false);
  const [draft, setDraft] = useState(null);
  const [suggestedPoints, setSuggestedPoints] = useState(null); // what the AI proposed, for reference
  const [convertError, setConvertError] = useState("");
  const [pinning, setPinning] = useState(false);
  const [newDeadline, setNewDeadline] = useState("");
  const [newAttachment, setNewAttachment] = useState(null);

  // Edit-quest modal state
  const [editingQuest, setEditingQuest] = useState(null);
  const [editDeadline, setEditDeadline] = useState("");
  const [editAttachment, setEditAttachment] = useState(null);
  const [editPoints, setEditPoints] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Per-submission comment/feedback-file state, keyed by submission id
  const [reviewNotes, setReviewNotes] = useState({});
  const [reviewFiles, setReviewFiles] = useState({});

  // Surfaced failures + in-flight tracking, so a failed request never looks
  // like a successful one (and a double-click can't fire the same action twice).
  const [pinError, setPinError] = useState("");
  const [editError, setEditError] = useState("");
  const [reviewErrors, setReviewErrors] = useState({}); // keyed by submission id
  const [busyIds, setBusyIds] = useState([]); // submission ids with a request in flight

  function setReviewError(id, message) {
    setReviewErrors((errs) => {
      const next = { ...errs };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }

  async function readError(res, fallback) {
    const { error } = await res.json().catch(() => ({}));
    return error || fallback;
  }

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
    const data = await res.json();
    setDraft({ ...data, rubric: withRubricKeys(data.rubric) });
    setSuggestedPoints(data.bountyPoints ?? null);
  }

  async function pinQuest() {
    if (!draft) return;
    const bountyError = validateBounty(draft.bountyPoints);
    if (bountyError) {
      setPinError(bountyError);
      return;
    }
    // Blank rows are dropped; what's left must be a full 100% rubric.
    const rubric = (draft.rubric || [])
      .filter((r) => r.criterion.trim())
      .map(({ _key, ...r }) => ({ ...r, criterion: r.criterion.trim(), weightPoints: Number(r.weightPoints) || 0 }));
    if (rubric.length === 0) {
      setPinError("Add at least one rubric criterion.");
      return;
    }
    const rubricTotal = rubric.reduce((sum, r) => sum + r.weightPoints, 0);
    if (rubricTotal !== 100) {
      setPinError(`Rubric weights must add up to 100% (currently ${rubricTotal}%).`);
      return;
    }
    setPinning(true);
    setPinError("");

    const form = new FormData();
    Object.entries(draft).forEach(([key, value]) => {
      if (key === "rubric") form.append("rubric", JSON.stringify(rubric));
      else form.append(key, value);
    });
    if (newDeadline) form.append("deadline", newDeadline);
    if (newAttachment) form.append("attachment", newAttachment);

    try {
      const res = await fetch("/api/quests", { method: "POST", body: form });
      if (!res.ok) {
        setPinError(await readError(res, "Could not pin this quest — please try again."));
        return;
      }
      setCreatorOpen(false);
      setDraft(null);
      setSuggestedPoints(null);
      setSyllabusText("");
      setNewDeadline("");
      setNewAttachment(null);
      loadAll();
    } catch {
      setPinError("Network error — check your connection and try again.");
    } finally {
      setPinning(false);
    }
  }

  function openEdit(quest) {
    setEditingQuest(quest);
    setEditDeadline(quest.deadline ? new Date(quest.deadline).toISOString().slice(0, 10) : "");
    setEditAttachment(null);
    setEditPoints(String(quest.bountyPoints ?? ""));
    setEditError("");
  }

  async function saveEdit() {
    if (!editingQuest) return;
    const bountyError = validateBounty(editPoints);
    if (bountyError) {
      setEditError(bountyError);
      return;
    }
    setSavingEdit(true);
    setEditError("");

    const form = new FormData();
    form.append("deadline", editDeadline); // empty string clears the deadline
    if (editAttachment) form.append("attachment", editAttachment);
    if (Number(editPoints) !== editingQuest.bountyPoints) form.append("bountyPoints", editPoints);

    try {
      const res = await fetch(`/api/quests/${editingQuest._id}`, { method: "PATCH", body: form });
      if (!res.ok) {
        setEditError(await readError(res, "Could not save changes — please try again."));
        return;
      }
      setEditingQuest(null);
      loadAll();
    } catch {
      setEditError("Network error — check your connection and try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function reviewAction(id, action) {
    if (busyIds.includes(id)) return; // ignore double-clicks while a request is in flight
    setBusyIds((ids) => [...ids, id]);
    setReviewError(id, "");

    const form = new FormData();
    form.append("action", action);
    form.append("professorFeedback", reviewNotes[id] || "");
    if (reviewFiles[id]) form.append("feedbackFile", reviewFiles[id]);

    try {
      const res = await fetch(`/api/submissions/${id}`, { method: "PATCH", body: form });
      if (!res.ok) {
        // Leave the submission in the queue — nothing was saved.
        setReviewError(id, await readError(res, "Could not save this review — please try again."));
        return;
      }
      setQueue((q) => q.filter((s) => s._id !== id));
    } catch {
      setReviewError(id, "Network error — check your connection and try again.");
    } finally {
      setBusyIds((ids) => ids.filter((x) => x !== id));
    }
  }

  async function preCheck(id) {
    if (busyIds.includes(id)) return;
    setBusyIds((ids) => [...ids, id]);
    setReviewError(id, "");

    try {
      const res = await fetch("/api/ai/pre-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: id }),
      });
      if (!res.ok) {
        setReviewError(id, await readError(res, "The AI pre-check failed — please try again."));
        return;
      }
      await loadAll();
    } catch {
      setReviewError(id, "Network error — check your connection and try again.");
    } finally {
      setBusyIds((ids) => ids.filter((x) => x !== id));
    }
  }

  function updateRubricRow(key, patch) {
    setDraft((d) => ({ ...d, rubric: d.rubric.map((r) => (r._key === key ? { ...r, ...patch } : r)) }));
  }
  function removeRubricRow(key) {
    setDraft((d) => ({ ...d, rubric: d.rubric.filter((r) => r._key !== key) }));
  }
  function addRubricRow() {
    setDraft((d) => ({
      ...d,
      rubric: [...(d.rubric || []), { criterion: "", weightPoints: 0, automatedCheckable: false, _key: ++rubricKeySeq }],
    }));
  }
  const draftRubricTotal = (draft?.rubric || []).reduce((sum, r) => sum + (Number(r.weightPoints) || 0), 0);

  const filteredQuests =
    questFilter === "posted" ? quests.filter((q) => !isExpired(q)) :
    questFilter === "expired" ? quests.filter(isExpired) :
    quests;
  const filterCount = (key) =>
    key === "all" ? quests.length :
    key === "posted" ? quests.filter((q) => !isExpired(q)).length :
    quests.filter(isExpired).length;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-24 page-enter">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="hub-eyebrow">Faculty hub</div>
          <h1 className="font-display font-bold text-3xl leading-tight">Quests &amp; reviews</h1>
          <p className="meta mt-1">Post quests, keep an eye on what&apos;s live, and sign off submissions.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setPinError(""); setCreatorOpen(true); }}>
          <Plus size={16} aria-hidden="true" /> Add new quest
        </button>
      </header>

      <div className="stat-strip grid-cols-3 mb-8">
        <div>
          <div className="stat-label">Waiting for review</div>
          <div className="stat-value">{queue.length}<small>{queue.length === 1 ? "submission" : "submissions"}</small></div>
        </div>
        <div>
          <div className="stat-label">Posted this term</div>
          <div className="stat-value">{quests.length}<small>{quests.length === 1 ? "quest" : "quests"}</small></div>
        </div>
        <div>
          <div className="stat-label">Bounty on offer</div>
          <div className="stat-value">
            {quests.reduce((sum, q) => sum + (q.bountyPoints || 0), 0).toLocaleString("en-US")}<small>pts</small>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <section className="hub-card" aria-labelledby="queue-title">
          <div className="hub-card-head">
            <h2 id="queue-title" className="hub-card-title">Review queue</h2>
            <span className="count-pill">{queue.length}</span>
          </div>

          {queue.length === 0 ? (
            <p className="empty-note">Nothing waiting on you right now. New submissions show up here.</p>
          ) : (
            <div className="row-list">
              {queue.map((s) => {
                const busy = busyIds.includes(s._id);
                return (
                  <article key={s._id} className="row !py-5">
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-full bg-[var(--wood)] text-[var(--on-wood)] grid place-content-center text-sm font-bold shrink-0" aria-hidden="true">
                        {(s.student?.name || "?")[0].toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium">{s.student?.name}</div>
                            <div className="meta">{s.quest?.title} · {s.quest?.course}</div>
                          </div>
                          <span className="badge badge-info shrink-0">{s.status === "AI_PreChecked" ? "AI pre-checked" : "Awaiting review"}</span>
                        </div>
                        <div className="mt-2">
                          {filesOf(s).length > 0 ? (
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {filesOf(s).map((f, i) => (
                                <a key={f.url} href={`/api/submissions/${s._id}/download?file=${i}`} className="file-link">
                                  <FileText size={14} aria-hidden="true" /> {f.name || "Download submitted file"}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="meta break-all">{s.repoLink}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 sm:pl-12">
                      {s.aiPreCheck ? (
                        s.aiPreCheck.textAnalyzed ? (
                          <div className="space-y-2 mb-4">
                            <div className="grid grid-cols-3 gap-2">
                              <div className="metric">
                                <div className="metric-label">Preliminary score</div>
                                <div className="metric-value">{s.aiPreCheck.preliminaryScore}<span className="font-normal text-[var(--ink)]/60"> / 100</span></div>
                              </div>
                              <div className="metric">
                                <div className="metric-label">Similarity</div>
                                <div className="metric-value">{s.aiPreCheck.similarityScore}%</div>
                                {s.aiPreCheck.similarityMatchStudentName && (
                                  <div className="metric-label truncate">vs {s.aiPreCheck.similarityMatchStudentName}</div>
                                )}
                              </div>
                              <div className="metric">
                                <div className="metric-label">Flags</div>
                                <div className="metric-value">{s.aiPreCheck.flagCount}</div>
                              </div>
                            </div>
                            {s.aiPreCheck.feedbackSummary && (
                              <div className="rounded-[10px] border border-[color:var(--line)] p-3 text-sm">
                                <div className="metric-label font-semibold mb-0.5">
                                  {s.aiPreCheck.fileFeedback?.length > 1 ? "AI feedback · overall" : "AI feedback"}
                                </div>
                                {s.aiPreCheck.feedbackSummary}
                              </div>
                            )}
                            {/* One comment per file. A single file's comment would only repeat the overall one. */}
                            {s.aiPreCheck.fileFeedback?.length > 1 &&
                              s.aiPreCheck.fileFeedback.map((f, i) => (
                                <div key={i} className="rounded-[10px] border border-[color:var(--line)] p-3 text-sm">
                                  <div className="metric-label font-semibold mb-0.5 flex items-center gap-1.5 min-w-0">
                                    <FileText size={12} aria-hidden="true" className="shrink-0" />
                                    <span className="truncate">File {i + 1} · {f.fileName}</span>
                                  </div>
                                  <p className={f.analyzed ? "" : "text-[var(--ink)]/60 italic"}>{f.feedback}</p>
                                </div>
                              ))}
                            {s.aiPreCheck.aiLikelihoodScore != null && (
                              <div className="rounded-[10px] bg-amber-50 p-3 text-sm">
                                <div className="text-xs font-semibold text-amber-800 mb-0.5">
                                  AI-content likelihood (heuristic): {s.aiPreCheck.aiLikelihoodScore}%
                                </div>
                                <p className="text-xs text-amber-800/80">{s.aiPreCheck.aiLikelihoodNote}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="metric text-sm mb-4">{s.aiPreCheck.feedbackSummary}</div>
                        )
                      ) : (
                        <button className="btn btn-sm btn-outline mb-4" disabled={busy} onClick={() => preCheck(s._id)}>
                          <Sparkles size={14} aria-hidden="true" />
                          {busy ? "Checking…" : "Run AI pre-check"}
                        </button>
                      )}
                      {s.aiPreCheck && (
                        <button type="button" className="quiet-btn -mt-2 mb-3" disabled={busy} onClick={() => preCheck(s._id)}>
                          <Sparkles size={14} aria-hidden="true" />
                          {busy ? "Checking…" : "Re-run AI pre-check"}
                        </button>
                      )}

                      <label htmlFor={`note-${s._id}`} className="sr-only">Comment for {s.student?.name}</label>
                      <textarea
                        id={`note-${s._id}`}
                        rows={2}
                        placeholder="Comment for the student…"
                        value={reviewNotes[s._id] || ""}
                        onChange={(e) => setReviewNotes((n) => ({ ...n, [s._id]: e.target.value }))}
                        className="field mb-3"
                      />

                      {reviewErrors[s._id] && <p className="text-xs text-red-600 mb-3">{reviewErrors[s._id]}</p>}

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="quiet-btn cursor-pointer min-w-0">
                          <Paperclip size={14} aria-hidden="true" />
                          <span className="truncate max-w-[180px]">{reviewFiles[s._id]?.name || "Attach a file back"}</span>
                          <input
                            type="file"
                            className="sr-only"
                            onChange={(e) => setReviewFiles((f) => ({ ...f, [s._id]: e.target.files?.[0] || null }))}
                          />
                        </label>
                        <div className="flex gap-2 ml-auto">
                          <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => reviewAction(s._id, "revise")}>Request revision</button>
                          <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => reviewAction(s._id, "approve")}>
                            {busy ? "Saving…" : "Approve & award"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="hub-card" aria-labelledby="posted-title">
          <div className="hub-card-head flex-wrap">
            <h2 id="posted-title" className="hub-card-title">Posted quests</h2>
            <div className="seg" role="group" aria-label="Filter posted quests">
              {QUEST_FILTERS.map((f) => (
                <button key={f.key} type="button" aria-pressed={questFilter === f.key} onClick={() => setQuestFilter(f.key)}>
                  {f.label} <span className="tabular-nums opacity-70">{filterCount(f.key)}</span>
                </button>
              ))}
            </div>
          </div>

          {quests.length === 0 ? (
            <p className="empty-note">No quests posted yet. Add your first one above.</p>
          ) : filteredQuests.length === 0 ? (
            <p className="empty-note">No {questFilter} quests right now.</p>
          ) : (
            <div className="row-list">
              {filteredQuests.map((q) => {
                const expired = isExpired(q);
                return (
                  <div key={q._id} className="row">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-sm leading-snug">{q.title}</div>
                        <div className="meta">{q.course}</div>
                      </div>
                      <span className="text-sm font-bold text-gold-ink tabular-nums shrink-0">+{q.bountyPoints}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`badge ${expired ? "badge-quiet" : "badge-ok"}`}>{expired ? "Expired" : q.status}</span>
                        <span className={`text-xs inline-flex items-center gap-1 ${expired ? "text-red-600 font-medium" : "text-[var(--ink)]/70"}`}>
                          <CalendarDays size={12} aria-hidden="true" />
                          {q.deadline ? `${expired ? "Ended" : "Due"} ${formatDeadline(q.deadline)}` : "No deadline"}
                        </span>
                      </div>
                      <button className="quiet-btn shrink-0" onClick={() => openEdit(q)} aria-label={`Edit "${q.title}"`}>
                        <Pencil size={13} aria-hidden="true" /> Edit
                      </button>
                    </div>
                    {q.attachmentUrl && (
                      <a href={q.attachmentUrl} target="_blank" rel="noreferrer" className="file-link mt-2">
                        <Paperclip size={12} aria-hidden="true" /> {q.attachmentName}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {/* Create quest modal */}
      <div className={`modal-backdrop ${creatorOpen ? "open" : ""}`} onClick={() => setCreatorOpen(false)}>
        {creatorOpen && (
          <div
            className="w-[92vw] max-w-2xl plain-modal max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="creator-title"
          >
            <div className="flex items-start justify-between gap-4 px-8 pt-7 pb-4 border-b border-[color:var(--line)]">
              <div>
                <h3 id="creator-title" className="font-display font-bold text-xl mb-1">Add a new quest</h3>
                <p className="text-sm text-[var(--ink)]/70">Paste a syllabus excerpt and let AI draft the quest — then edit before you pin it.</p>
              </div>
              <button className="quiet-btn shrink-0" onClick={() => setCreatorOpen(false)} aria-label="Close">
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-7">
              <section>
                <label htmlFor="quest-syllabus" className="creator-label">Syllabus excerpt</label>
                <textarea
                  id="quest-syllabus"
                  rows={draft ? 2 : 5}
                  value={syllabusText}
                  onChange={(e) => setSyllabusText(e.target.value)}
                  placeholder="Paste raw syllabus text here…"
                  className="field mb-3"
                />
                {convertError && <p className="text-xs text-red-600 mb-2">{convertError}</p>}
                <button className="btn btn-sm btn-outline" onClick={convertSyllabus} disabled={converting || syllabusText.trim().length < 20}>
                  <Sparkles size={14} aria-hidden="true" />
                  {converting ? "Converting…" : draft ? "Regenerate with AI" : "Convert with AI"}
                </button>
              </section>

            {draft && (
              <>
              <section className="space-y-3">
                <div>
                  <label htmlFor="quest-title" className="creator-label">Title</label>
                  <input id="quest-title" className="field font-medium" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="quest-description" className="creator-label">Instructions</label>
                  <AutoGrowTextarea
                    id="quest-description"
                    minRows={4}
                    className="field leading-relaxed"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </div>
              </section>

              <section>
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <span className="creator-label !mb-0">Rubric</span>
                  <span className={`text-xs font-semibold tabular-nums ${draftRubricTotal === 100 ? "text-emerald-700" : "text-red-600"}`}>
                    Total {draftRubricTotal}% {draftRubricTotal === 100 ? "✓" : "· must equal 100%"}
                  </span>
                </div>
                <div className="rounded-[10px] border border-[color:var(--line)] divide-y divide-[color:var(--line)] bg-[#FFFEF0]">
                  {(draft.rubric || []).length === 0 && (
                    <p className="text-sm text-[var(--ink)]/60 px-3 py-3">No criteria yet — add one below.</p>
                  )}
                  {(draft.rubric || []).map((r, i) => (
                    <div key={r._key} className="flex items-start gap-2 px-3 py-2">
                      <span className="text-xs text-[var(--ink)]/50 tabular-nums w-5 pt-2.5 shrink-0" aria-hidden="true">{i + 1}.</span>
                      <AutoGrowTextarea
                        minRows={1}
                        aria-label={`Criterion ${i + 1}`}
                        placeholder="Describe what's assessed…"
                        className="flex-1 min-w-0 bg-transparent text-sm leading-snug py-2 px-1 rounded-md focus:bg-white outline-none focus:ring-1 focus:ring-[color:var(--wood)]"
                        value={r.criterion}
                        onChange={(e) => updateRubricRow(r._key, { criterion: e.target.value })}
                      />
                      <div className="flex items-center gap-1 shrink-0 pt-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max="100"
                          aria-label={`Weight for criterion ${i + 1}`}
                          className="field !w-16 !py-1 !px-2 text-right tabular-nums"
                          value={r.weightPoints}
                          onChange={(e) => updateRubricRow(r._key, { weightPoints: e.target.value })}
                        />
                        <span className="text-xs text-[var(--ink)]/60">%</span>
                        <button
                          type="button"
                          className="quiet-btn !px-1.5"
                          onClick={() => removeRubricRow(r._key)}
                          aria-label={`Remove criterion ${i + 1}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="quiet-btn mt-2" onClick={addRubricRow}>
                  <Plus size={14} aria-hidden="true" /> Add criterion
                </button>
              </section>

              <section className="space-y-3">
                <span className="creator-label">Details</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="quest-difficulty" className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">Difficulty</label>
                    <select id="quest-difficulty" className="field" value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}>
                      <option>Apprentice</option><option>Journeyman</option><option>Master</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="quest-hours" className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">Estimated hours</label>
                    <input id="quest-hours" className="field" value={draft.estimatedHours} onChange={(e) => setDraft({ ...draft, estimatedHours: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label htmlFor="quest-bounty" className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">Bounty points</label>
                    <input
                      id="quest-bounty"
                      type="number"
                      inputMode="numeric"
                      min={MIN_BOUNTY_POINTS}
                      max={MAX_BOUNTY_POINTS}
                      step="1"
                      className="field"
                      value={draft.bountyPoints}
                      onChange={(e) => setDraft({ ...draft, bountyPoints: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-xs text-[var(--ink)]/70 -mt-1">
                  You decide the bounty ({MIN_BOUNTY_POINTS}–{MAX_BOUNTY_POINTS} points).
                  {suggestedPoints != null && Number(draft.bountyPoints) !== suggestedPoints && (
                    <>
                      {" "}The AI suggested {suggestedPoints}.{" "}
                      <button type="button" className="underline" onClick={() => setDraft({ ...draft, bountyPoints: suggestedPoints })}>
                        Use that
                      </button>
                    </>
                  )}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="quest-deadline" className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">Deadline (optional)</label>
                    <input
                      id="quest-deadline"
                      type="date"
                      value={newDeadline}
                      onChange={(e) => setNewDeadline(e.target.value)}
                      className="field"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">Rubric file or image (optional)</span>
                    <label className="field flex items-center gap-2 cursor-pointer hover:bg-white min-w-0">
                      <Paperclip size={14} className="shrink-0 text-[var(--ink)]/60" aria-hidden="true" />
                      <span className={`truncate ${newAttachment ? "" : "text-[var(--ink)]/60"}`}>
                        {newAttachment?.name || "Choose a file…"}
                      </span>
                      <input type="file" className="sr-only" onChange={(e) => setNewAttachment(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
              </section>
              </>
            )}
            </div>

            {draft && (
              <div className="px-8 py-4 border-t border-[color:var(--line)]">
                {pinError && <p className="text-xs text-red-600 mb-2">{pinError}</p>}
                <button className="btn btn-primary w-full" onClick={pinQuest} disabled={pinning}>
                  {pinning ? "Pinning…" : "Pin to board"}
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
            <p className="text-sm text-[var(--ink)]/70 mb-5">Update the bounty or deadline, or swap the attached file.</p>

            <label htmlFor="edit-bounty" className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">Bounty points</label>
            <input
              id="edit-bounty"
              type="number"
              inputMode="numeric"
              min={MIN_BOUNTY_POINTS}
              max={MAX_BOUNTY_POINTS}
              step="1"
              value={editPoints}
              onChange={(e) => setEditPoints(e.target.value)}
              className="field mb-1"
            />
            <p className="text-xs text-[var(--ink)]/70 mb-4">
              Applies to approvals from now on. Students already approved keep the points they earned.
            </p>

            <label className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">Deadline</label>
            <input
              type="date"
              value={editDeadline}
              onChange={(e) => setEditDeadline(e.target.value)}
              className="field mb-3"
            />
            <p className="text-xs text-[var(--ink)]/70 mb-4">Leave blank and save to remove the deadline entirely.</p>

            <label className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">Replace attached file</label>
            <input
              type="file"
              onChange={(e) => setEditAttachment(e.target.files?.[0] || null)}
              className="w-full text-sm mb-6"
            />

            {editError && <p className="text-xs text-red-600 mb-3">{editError}</p>}

            <button className="btn btn-primary w-full" onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
