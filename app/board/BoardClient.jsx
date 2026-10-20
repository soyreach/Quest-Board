"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import FilterDropdown from "@/components/FilterDropdown";

const TAPE = { Apprentice: "tape-a", Journeyman: "tape-j", Master: "tape-m" };

function formatDeadline(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
  const [filters, setFilters] = useState({ course: "", skillTag: "", difficulty: "", minPoints: 0 });
  const [openQuest, setOpenQuest] = useState(null);
  const [dissolvingIds, setDissolvingIds] = useState([]);
  const [file, setFile] = useState(null);
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

  const courses = useMemo(() => [...new Set(allQuestsForFilters.map((q) => q.course))], [allQuestsForFilters]);
  const skills = useMemo(() => [...new Set(allQuestsForFilters.map((q) => q.skillTag))], [allQuestsForFilters]);

  async function handleSubmitQuest(questId) {
    if (!file) {
      setSubmitError("Choose a file to upload first.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");

    const form = new FormData();
    form.append("questId", questId);
    form.append("file", file);

    const res = await fetch("/api/submissions", { method: "POST", body: form });
    setSubmitting(false);

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setSubmitError(error || "Could not submit — try again.");
      return;
    }

    setOpenQuest(null);
    setFile(null);
    setDissolvingIds((ids) => [...ids, questId]);
    setTimeout(() => {
      setQuests((qs) => qs.filter((q) => q._id !== questId));
      setDissolvingIds((ids) => ids.filter((id) => id !== questId));
    }, 550);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-10 pb-24 page-enter">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-bold text-3xl mb-1">The quest board</h1>
          <p className="text-[var(--ink)]/70 text-sm">Pinned by your professors this term. Click a quest to read the full brief.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 bg-[var(--paper)] rounded-xl p-4 shadow-paper">
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
        <span className="ml-auto self-center text-xs text-[var(--ink)]/70">
          {loading ? "Loading…" : `${quests.length} quest${quests.length === 1 ? "" : "s"} pinned`}
        </span>
      </div>

      <div className="corkboard p-8 md:p-10 min-h-[560px] grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
        {!loading && quests.length === 0 && (
          <p className="text-[var(--ink)]/70 col-span-full text-center py-20">No quests match those filters yet.</p>
        )}
        {quests.map((q, i) => (
          <div
            key={q._id}
            className={`quest-card p-5 ${dissolvingIds.includes(q._id) ? "dissolving" : ""}`}
            style={{ transform: `rotate(${((i % 5) - 2) * 0.7}deg)` }}
            onClick={() => { setOpenQuest(q); setSubmitError(""); setFile(null); }}
          >
            <div className="pin" />
            <div className="stamp">{q.bountyPoints}<small>PTS</small></div>
            <span className={`tape ${TAPE[q.difficulty] || "tape-j"}`}>{q.difficulty}</span>
            <h3 className="font-display font-semibold text-lg leading-snug mt-2 mb-0.5 pr-16 line-clamp-2" style={{ color: "var(--ink)" }}>{q.title}</h3>
            <div className="text-xs mb-2 text-[var(--wood)] line-clamp-1">{q.course}</div>
            <p className="text-[13px] leading-relaxed line-clamp-3" style={{ color: "#4f3f27" }}>
              {q.description}
            </p>
            <div className="mt-auto pt-4 flex items-center justify-between gap-3">
              <span className="text-xs font-medium truncate" style={{ color: "#6f5420" }}>{q.skillTag}</span>
              {q.deadline && (
                <span className="text-xs font-semibold shrink-0" style={{ color: "#8A2F2F" }}>Due {formatDeadline(q.deadline)}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={`modal-backdrop ${openQuest ? "open" : ""}`} onClick={() => setOpenQuest(null)}>
        {openQuest && (
          <div
            className="parchment-modal w-[92vw] max-w-2xl max-h-[86vh] overflow-y-auto p-8 md:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="badge" style={{ background: "rgba(201,154,60,0.2)", color: "#7a5a1e" }}>
                {openQuest.course} · {openQuest.difficulty} · {openQuest.estimatedHours}h est.
              </span>
              <button onClick={() => setOpenQuest(null)} className="text-2xl leading-none text-[#5c4a2c]/60 hover:text-[#5c4a2c]">&times;</button>
            </div>
            <h2 className="font-display font-semibold text-3xl mb-3" style={{ color: "var(--ink)" }}>{openQuest.title}</h2>
            <p className="text-sm mb-5" style={{ color: "#4a3a20" }}>{openQuest.industryContext || openQuest.description}</p>

            {(openQuest.deadline || openQuest.attachmentUrl) && (
              <div className="flex flex-wrap gap-3 mb-5 text-xs" style={{ color: "#6b5a3a" }}>
                {openQuest.deadline && <span>📅 Due {formatDeadline(openQuest.deadline)}</span>}
                {openQuest.attachmentUrl && (
                  <a href={openQuest.attachmentUrl} target="_blank" rel="noreferrer" className="underline">
                    📎 {openQuest.attachmentName || "View attached file"}
                  </a>
                )}
              </div>
            )}

            <h4 className="font-semibold text-sm mb-2" style={{ color: "#3a2c14" }}>Rubric</h4>
            <div className="space-y-1 mb-6 text-sm">
              {(openQuest.rubric || []).map((r) => (
                <div key={r.criterion} className="flex justify-between border-b border-black/10 py-1">
                  <span>{r.criterion}</span><span className="font-medium">{r.weightPoints}%</span>
                </div>
              ))}
            </div>

            {session?.user?.role === "Student" ? (
              <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.4)" }}>
                <h4 className="font-semibold text-sm mb-3" style={{ color: "#3a2c14" }}>Turn in your work</h4>

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer mb-3 transition"
                  style={{
                    borderColor: dragOver ? "var(--indigo)" : "rgba(0,0,0,0.15)",
                    background: dragOver ? "rgba(117,96,75,0.1)" : "rgba(255,255,255,0.5)",
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {file ? (
                    <p className="text-sm font-medium" style={{ color: "#3a2c14" }}>📄 {file.name}</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium mb-1" style={{ color: "#3a2c14" }}>Drag a file here, or</p>
                      <p className="text-sm underline" style={{ color: "var(--indigo)" }}>Choose a file to upload</p>
                    </>
                  )}
                </div>

                {submitError && <p className="text-xs text-red-600 mb-2">{submitError}</p>}
                <button className="btn btn-primary w-full" disabled={submitting} onClick={() => handleSubmitQuest(openQuest._id)}>
                  {submitting ? "Submitting…" : "Turn in quest"}
                </button>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "#6b5a3a" }}>
                Sign in as a student to submit work for this quest.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
