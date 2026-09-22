"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

function formatDeadline(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function BoardClient({ initialQuests }) {
  const { data: session } = useSession();
  const [quests, setQuests] = useState(initialQuests);
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

  const courses = useMemo(() => [...new Set(quests.map((q) => q.course))], [quests]);
  const skills = useMemo(() => [...new Set(quests.map((q) => q.skillTag))], [quests]);

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
          <p className="text-[var(--ink)]/55 text-sm">Pinned by your professors this term. Click a quest to read the full brief.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6 bg-white rounded-2xl p-4 shadow-[0_10px_30px_-18px_rgba(20,18,43,0.4)]">
        <select
          className="text-sm rounded-full border border-black/10 px-4 py-2 bg-white"
          value={filters.course}
          onChange={(e) => setFilters((f) => ({ ...f, course: e.target.value }))}
        >
          <option value="">All courses</option>
          {courses.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select
          className="text-sm rounded-full border border-black/10 px-4 py-2 bg-white"
          value={filters.skillTag}
          onChange={(e) => setFilters((f) => ({ ...f, skillTag: e.target.value }))}
        >
          <option value="">All skill tags</option>
          {skills.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          className="text-sm rounded-full border border-black/10 px-4 py-2 bg-white"
          value={filters.difficulty}
          onChange={(e) => setFilters((f) => ({ ...f, difficulty: e.target.value }))}
        >
          <option value="">Any difficulty</option>
          <option>Apprentice</option><option>Journeyman</option><option>Master</option>
        </select>
        <select
          className="text-sm rounded-full border border-black/10 px-4 py-2 bg-white"
          value={filters.minPoints}
          onChange={(e) => setFilters((f) => ({ ...f, minPoints: parseInt(e.target.value, 10) }))}
        >
          <option value="0">Any bounty</option>
          <option value="100">100+ pts</option>
          <option value="200">200+ pts</option>
          <option value="300">300+ pts</option>
        </select>
        <span className="ml-auto self-center text-xs text-[var(--ink)]/45">
          {loading ? "Loading…" : `${quests.length} quest${quests.length === 1 ? "" : "s"} pinned`}
        </span>
      </div>

      <div className="corkboard p-8 md:p-12 min-h-[560px] grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {!loading && quests.length === 0 && (
          <p className="text-white/70 col-span-full text-center py-20">No quests match those filters yet.</p>
        )}
        {quests.map((q, i) => (
          <div
            key={q._id}
            className={`quest-card p-5 ${dissolvingIds.includes(q._id) ? "dissolving" : ""}`}
            style={{ transform: `rotate(${(i % 5) - 2}deg)` }}
            onClick={() => { setOpenQuest(q); setSubmitError(""); setFile(null); }}
          >
            <div className="pin" />
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-semibold tracking-wide text-[var(--cork-dark)]/70">
                {q.course} · {q.difficulty}
              </span>
              <span className="badge" style={{ background: "rgba(201,154,60,0.18)", color: "#7a5a1e" }}>
                +{q.bountyPoints} PTS
              </span>
            </div>
            <h3 className="font-hand text-xl leading-snug mb-2" style={{ color: "#3a2c14" }}>{q.title}</h3>
            <p className="text-xs leading-relaxed" style={{ color: "#5c4a2c" }}>
              {(q.description || "").slice(0, 90)}…
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] font-medium" style={{ color: "#8a6a2e" }}>{q.skillTag}</span>
              {q.deadline && (
                <span className="text-[10px] font-medium" style={{ color: "#7a3a3a" }}>Due {formatDeadline(q.deadline)}</span>
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
            <h2 className="font-hand text-3xl mb-3" style={{ color: "#3a2c14" }}>{openQuest.title}</h2>
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
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.4)" }}>
                <h4 className="font-semibold text-sm mb-3" style={{ color: "#3a2c14" }}>Turn in your work</h4>

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer mb-3 transition"
                  style={{
                    borderColor: dragOver ? "var(--indigo)" : "rgba(0,0,0,0.15)",
                    background: dragOver ? "rgba(56,198,236,0.08)" : "rgba(255,255,255,0.5)",
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
