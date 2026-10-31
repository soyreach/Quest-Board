"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CalendarClock, Clock, FileText, Paperclip, RotateCcw, Upload, X } from "lucide-react";
import FilterDropdown from "@/components/FilterDropdown";
import { MAX_SUBMISSION_FILES } from "@/lib/constants";
import { useLingering } from "@/lib/useLingering";

const TAPE = { Apprentice: "tape-a", Journeyman: "tape-j", Master: "tape-m" };
const EMPTY_FILTERS = { course: "", skillTag: "", difficulty: "", minPoints: 0 };

function formatDeadline(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Whole days from now until the deadline (negative once it has passed).
function daysLeft(deadline) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BoardClient({ initialQuests }) {
  const { data: session } = useSession();
  const [quests, setQuests] = useState(initialQuests);
  // A stable snapshot of everything the board showed on first load, used ONLY
  // to build the dropdown option lists. `quests` itself gets replaced by
  // whatever the current filters return, so deriving options from `quests`
  // would make each selection shrink the choices available next time
  // (pick one course, and every other course disappears from the list).
  const [allQuestsForFilters] = useState(initialQuests);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedQuest, setOpenQuest] = useState(null);
  const openQuest = useLingering(selectedQuest); // stays on screen while the brief closes
  const [dissolvingIds, setDissolvingIds] = useState([]);
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileInputRef = useRef(null);
  const isFirstRender = useRef(true);

  async function loadQuests() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.course) params.set("course", filters.course);
    if (filters.skillTag) params.set("skillTag", filters.skillTag);
    if (filters.difficulty) params.set("difficulty", filters.difficulty);
    if (filters.minPoints) params.set("minPoints", filters.minPoints);
    const res = await fetch(`/api/quests?${params.toString()}`);
    const data = await res.json();
    setQuests(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  // The initial list already arrived server-side with the page itself — no
  // need to re-fetch it the moment the component mounts. Only refetch when
  // the person actually changes a filter after that.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    loadQuests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Escape closes the quest brief.
  useEffect(() => {
    if (!openQuest) return;
    function onKey(e) {
      if (e.key === "Escape") setOpenQuest(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openQuest]);

  const courses = useMemo(() => [...new Set(allQuestsForFilters.map((q) => q.course))], [allQuestsForFilters]);
  const skills = useMemo(() => [...new Set(allQuestsForFilters.map((q) => q.skillTag))], [allQuestsForFilters]);
  const activeFilters = [filters.course, filters.skillTag, filters.difficulty, filters.minPoints].filter(Boolean).length;

  function openBrief(q) {
    setOpenQuest(q);
    setSubmitError("");
    setFiles([]);
  }

  // Adds picked or dropped files, skipping any already in the list.
  function addFiles(list) {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    const key = (f) => `${f.name}-${f.size}-${f.lastModified}`;
    const seen = new Set(files.map(key));
    const merged = [...files, ...incoming.filter((f) => !seen.has(key(f)))];
    setSubmitError(merged.length > MAX_SUBMISSION_FILES ? `You can turn in at most ${MAX_SUBMISSION_FILES} files.` : "");
    setFiles(merged.slice(0, MAX_SUBMISSION_FILES));
  }

  async function handleSubmitQuest(questId) {
    if (!files.length) {
      setSubmitError("Choose at least one file to upload first.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");

    const form = new FormData();
    form.append("questId", questId);
    for (const f of files) form.append("file", f);

    const res = await fetch("/api/submissions", { method: "POST", body: form });
    setSubmitting(false);

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setSubmitError(error || "Could not submit — try again.");
      return;
    }

    setOpenQuest(null);
    setFiles([]);
    setDissolvingIds((ids) => [...ids, questId]);
    setTimeout(() => {
      setQuests((qs) => qs.filter((q) => q._id !== questId));
      setDissolvingIds((ids) => ids.filter((id) => id !== questId));
    }, 550);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  const openDays = daysLeft(openQuest?.deadline);

  return (
    <div className="max-w-7xl mx-auto px-6 pt-10 pb-24 page-enter">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="hub-eyebrow">Pinned this term</div>
          <h1 className="font-display font-bold text-3xl leading-tight">The quest board</h1>
          <p className="meta mt-1">Real briefs from your professors. Open a quest to read the full brief and turn in your work.</p>
        </div>
      </header>

      <div className="filter-bar mb-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <FilterDropdown
            width="220px"
            label="All courses"
            value={filters.course}
            onChange={(v) => setFilters((f) => ({ ...f, course: v }))}
            options={[{ value: "", label: "All courses" }, ...courses.map((c) => ({ value: c, label: c }))]}
          />
          <FilterDropdown
            width="200px"
            label="All skill tags"
            value={filters.skillTag}
            onChange={(v) => setFilters((f) => ({ ...f, skillTag: v }))}
            options={[{ value: "", label: "All skill tags" }, ...skills.map((s) => ({ value: s, label: s }))]}
          />
          <FilterDropdown
            width="170px"
            label="Any difficulty"
            value={filters.difficulty}
            onChange={(v) => setFilters((f) => ({ ...f, difficulty: v }))}
            options={[
              { value: "", label: "Any difficulty" },
              { value: "Apprentice", label: "Apprentice" },
              { value: "Journeyman", label: "Journeyman" },
              { value: "Master", label: "Master" },
            ]}
          />
          <FilterDropdown
            width="150px"
            label="Any bounty"
            value={filters.minPoints}
            onChange={(v) => setFilters((f) => ({ ...f, minPoints: parseInt(v, 10) }))}
            options={[
              { value: 0, label: "Any bounty" },
              { value: 100, label: "100+ pts" },
              { value: 200, label: "200+ pts" },
              { value: 300, label: "300+ pts" },
            ]}
          />
          {activeFilters > 0 && (
            <button type="button" className="quiet-btn" onClick={() => setFilters(EMPTY_FILTERS)}>
              <RotateCcw size={14} aria-hidden="true" /> Clear filters
            </button>
          )}
        </div>
        <span className="meta tabular-nums shrink-0" role="status">
          {loading ? "Loading…" : `${quests.length} quest${quests.length === 1 ? "" : "s"} pinned`}
        </span>
      </div>

      <div
        className={`corkboard cards-in p-6 sm:p-8 md:p-10 min-h-[560px] grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10 content-start transition-opacity duration-200 ${loading ? "opacity-60" : ""}`}
        aria-busy={loading}
      >
        {!loading && quests.length === 0 && (
          <div className="col-span-full flex justify-center py-12">
            <div className="paper-note max-w-sm text-center" style={{ transform: "rotate(-1deg)" }}>
              <div className="pin" />
              <h2 className="font-display font-semibold text-lg mb-1">Nothing pinned here</h2>
              <p className="meta mb-4">No quests match those filters yet. Try widening the search.</p>
              {activeFilters > 0 && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
        {quests.map((q, i) => {
          const days = daysLeft(q.deadline);
          const dueSoon = days !== null && days <= 3;
          return (
            <article
              key={q._id}
              role="button"
              tabIndex={0}
              aria-label={`${q.title}, ${q.bountyPoints} points. Open brief`}
              className={`quest-card p-5 ${dissolvingIds.includes(q._id) ? "dissolving" : ""}`}
              style={{ transform: `rotate(${((i % 5) - 2) * 0.7}deg)`, "--i": Math.min(i, 8) }}
              onClick={() => openBrief(q)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openBrief(q);
                }
              }}
            >
              <div className="pin" />
              <div className="stamp">{q.bountyPoints}<small>PTS</small></div>
              <span className={`tape ${TAPE[q.difficulty] || "tape-j"}`}>{q.difficulty}</span>
              <h3 className="font-display font-semibold text-lg leading-snug mt-2.5 mb-0.5 pr-16 line-clamp-2">{q.title}</h3>
              <div className="text-xs font-medium mb-2.5 text-[var(--wood)] line-clamp-1">{q.course}</div>
              <p className="text-[13px] leading-relaxed line-clamp-3 text-[var(--ink)]/80 mb-4">{q.description}</p>
              <div className="mt-auto pt-3 flex items-center justify-between gap-3 border-t border-dashed border-[color:var(--line)]">
                <span className="skill-chip truncate">{q.skillTag}</span>
                {q.deadline && (
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${dueSoon ? "text-[var(--stamp)]" : "text-[var(--muted)]"}`}>
                    <CalendarClock size={13} aria-hidden="true" />
                    {dueSoon && days >= 0 ? (days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} left`) : `Due ${formatDeadline(q.deadline)}`}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className={`modal-backdrop ${selectedQuest ? "open" : ""}`} onClick={() => setOpenQuest(null)}>
        {openQuest && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quest-brief-title"
            className="parchment-modal w-[92vw] max-w-2xl max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8 pb-0 sm:pb-0">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className={`tape ${TAPE[openQuest.difficulty] || "tape-j"}`}>{openQuest.difficulty}</span>
                  <span className="meta truncate">{openQuest.course}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenQuest(null)}
                  aria-label="Close brief"
                  className="quiet-btn -mr-2 -mt-1 shrink-0"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <h2 id="quest-brief-title" className="font-display font-semibold text-2xl sm:text-3xl leading-tight mb-5">
                {openQuest.title}
              </h2>

              <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="metric">
                  <div className="metric-label">Bounty</div>
                  <div className="metric-value text-[var(--stamp)]">{openQuest.bountyPoints} pts</div>
                </div>
                <div className="metric">
                  <div className="metric-label">Estimated</div>
                  <div className="metric-value inline-flex items-center gap-1">
                    <Clock size={13} aria-hidden="true" className="text-[var(--muted)]" />
                    {openQuest.estimatedHours ? `${openQuest.estimatedHours}h` : "—"}
                  </div>
                </div>
                <div className="metric">
                  <div className="metric-label">Due</div>
                  <div className={`metric-value text-sm sm:text-base ${openDays !== null && openDays <= 3 ? "text-[var(--stamp)]" : ""}`}>
                    {openQuest.deadline ? formatDeadline(openQuest.deadline) : "No deadline"}
                  </div>
                </div>
              </div>

              <div className="creator-label">The brief</div>
              <p className="text-sm leading-relaxed mb-4 whitespace-pre-line">{openQuest.industryContext || openQuest.description}</p>
              {openQuest.attachmentUrl && (
                <a href={openQuest.attachmentUrl} target="_blank" rel="noreferrer" className="file-link mb-6">
                  <Paperclip size={13} aria-hidden="true" /> {openQuest.attachmentName || "View attached file"}
                </a>
              )}

              {(openQuest.rubric || []).length > 0 && (
                <div className="mt-2 mb-6">
                  <div className="creator-label">How it&apos;s graded</div>
                  <ul className="space-y-2.5">
                    {openQuest.rubric.map((r) => (
                      <li key={r.criterion}>
                        <div className="flex justify-between gap-3 text-sm mb-1">
                          <span>{r.criterion}</span>
                          <span className="font-semibold tabular-nums">{r.weightPoints}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/[0.07] overflow-hidden">
                          <div className="h-full rounded-full bg-[var(--wood)]" style={{ width: `${Math.min(100, r.weightPoints)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {session?.user?.role === "Student" ? (
              <div className="turn-in p-6 sm:p-8">
                <h3 className="font-display font-semibold text-base mb-3">Turn in your work</h3>

                {files.length > 0 && (
                  <ul className="space-y-2 mb-3">
                    {files.map((f) => (
                      <li key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center gap-3 rounded-xl border border-[color:var(--line)] bg-[#FFFEF0] px-4 py-3">
                        <span className="w-9 h-9 rounded-lg bg-[var(--lavender)] grid place-content-center text-[var(--wood)] shrink-0" aria-hidden="true">
                          <FileText size={17} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{f.name}</div>
                          <div className="meta">{formatSize(f.size)}</div>
                        </div>
                        <button
                          type="button"
                          className="quiet-btn shrink-0"
                          aria-label={`Remove ${f.name}`}
                          onClick={() => {
                            setFiles((current) => current.filter((x) => x !== f));
                            setSubmitError("");
                          }}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {files.length < MAX_SUBMISSION_FILES && (
                  <button
                    type="button"
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`dropzone w-full mb-3 ${dragOver ? "over" : ""} ${files.length ? "!py-3" : ""}`}
                  >
                    {files.length === 0 && (
                      <span className="w-10 h-10 rounded-full bg-[var(--lavender)] grid place-content-center text-[var(--wood)] mx-auto mb-2" aria-hidden="true">
                        <Upload size={18} />
                      </span>
                    )}
                    <span className="block text-sm font-medium">
                      {files.length ? "Drag more files here, or " : "Drag files here, or "}
                      <span className="underline underline-offset-2 text-[var(--wood)]">{files.length ? "add more" : "choose them"}</span>
                    </span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = ""; // so picking the same file again after removing it still fires
                  }}
                />

                {submitError && <p className="text-xs text-red-600 mb-2" role="alert">{submitError}</p>}
                <button className="btn btn-primary w-full" disabled={submitting} onClick={() => handleSubmitQuest(openQuest._id)}>
                  {submitting ? "Submitting…" : "Turn in quest"}
                </button>
              </div>
            ) : (
              <p className="turn-in meta px-6 sm:px-8 py-5">
                {session ? "Only students can turn in work for a quest." : (
                  <>
                    <Link href="/login" className="underline text-[var(--ink)]">Sign in as a student</Link> to submit work for this quest.
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
