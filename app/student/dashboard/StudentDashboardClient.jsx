"use client";

import { useState } from "react";

const CERT_THRESHOLD = 3000; // Silver tier — keep in sync with your certificate policy

export default function StudentDashboardClient({ initialMe, initialSubmissions, userName, userEmail }) {
  const [me] = useState(initialMe);
  const [submissions] = useState(initialSubmissions);
  const [tab, setTab] = useState("progress");
  const [copiedId, setCopiedId] = useState(null);

  const pending = submissions.filter((s) => s.status !== "Professor_Approved");
  const completed = submissions.filter((s) => s.status === "Professor_Approved");
  const points = me?.bountyPoints ?? 0;
  const pct = Math.min(100, Math.round((points / CERT_THRESHOLD) * 100));

  function copyBullet(id, text) {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1400);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-10 pb-24 page-enter">
      <div className="rounded-3xl p-8 md:p-10 mb-8 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg,var(--violet),var(--violet-2))" }}>
        <div className="absolute -right-16 -bottom-24 w-72 h-72 rounded-full" style={{ background: "radial-gradient(circle, rgba(56,198,236,0.4), transparent 70%)" }} />
        <div className="flex flex-wrap items-center gap-8 relative">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-display font-bold"
            style={{ background: `conic-gradient(#fff ${pct}%, rgba(255,255,255,0.18) 0)` }}>
            <div className="w-16 h-16 rounded-xl bg-[var(--violet)] flex items-center justify-center text-sm">{pct}%</div>
          </div>
          <div>
            <div className="badge bg-white/15 mb-2">{me?.tierBadge || "Apprentice"}</div>
            <h1 className="font-display font-bold text-2xl">{userName}</h1>
            <p className="text-white/60 text-sm">{userEmail}</p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-white/55 text-xs mb-1">Total bounty points</div>
            <div className="font-display font-bold text-4xl">{points}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 md:p-8 mb-8 shadow-[0_10px_30px_-20px_rgba(20,18,43,0.4)]">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Certificate progress — Silver tier</span>
          <span className="text-[var(--ink)]/50">{points} / {CERT_THRESHOLD} pts</span>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="bg-white rounded-3xl shadow-[0_10px_30px_-20px_rgba(20,18,43,0.4)] overflow-hidden">
        <div className="flex gap-8 px-6 pt-5 border-b border-black/5">
          <button className={`tab-btn ${tab === "progress" ? "active" : ""}`} onClick={() => setTab("progress")}>In progress</button>
          <button className={`tab-btn ${tab === "done" ? "active" : ""}`} onClick={() => setTab("done")}>Completed</button>
        </div>

        {tab === "progress" && (
          <div className="p-6 space-y-3">
            {pending.length === 0 && <p className="text-sm text-[var(--ink)]/50">Nothing pending — head to the board to pick up a quest.</p>}
            {pending.map((s) => (
              <div key={s._id} className="p-4 rounded-2xl bg-[var(--lavender)]">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium">{s.quest?.title}</div>
                  <span className="badge bg-white text-[var(--ink)]/60">{s.status.replace("_", " ")}</span>
                </div>
                <div className="text-xs text-[var(--ink)]/50 mb-2">{s.quest?.course}</div>
                {s.fileUrl && (
                  <a href={`/api/submissions/${s._id}/download`} className="text-xs underline text-[var(--indigo)]">
                    📄 {s.fileName}
                  </a>
                )}
                {s.professorFeedback && (
                  <p className="text-sm text-[var(--ink)]/60 italic mt-2">&quot;{s.professorFeedback}&quot;</p>
                )}
                {s.professorFeedbackFileUrl && (
                  <a href={`/api/submissions/${s._id}/download?which=feedback`} className="text-xs underline text-[var(--indigo)] block mt-1">
                    📎 {s.professorFeedbackFileName}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "done" && (
          <div className="p-6 space-y-4">
            {completed.length === 0 && <p className="text-sm text-[var(--ink)]/50">No approved quests yet.</p>}
            {completed.map((s) => (
              <div key={s._id} className="p-4 rounded-2xl border border-black/5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium">{s.quest?.title}</div>
                    <div className="text-xs text-[var(--ink)]/50">{s.quest?.course} · +{s.awardedPoints} pts</div>
                  </div>
                  <span className="badge bg-emerald-50 text-emerald-700">Approved</span>
                </div>
                {s.professorFeedback && (
                  <p className="text-sm text-[var(--ink)]/60 italic mb-1">&quot;{s.professorFeedback}&quot;</p>
                )}
                {s.professorFeedbackFileUrl && (
                  <a href={`/api/submissions/${s._id}/download?which=feedback`} className="text-xs underline text-[var(--indigo)] block mb-3">
                    📎 {s.professorFeedbackFileName}
                  </a>
                )}
                <div className="bg-[var(--lavender)] rounded-xl p-3 text-sm flex items-start justify-between gap-3">
                  <p>Completed &quot;{s.quest?.title}&quot; for {s.quest?.course}, earning {s.awardedPoints} bounty points on faculty review.</p>
                  <button
                    className="btn btn-sm btn-light border border-black/10 shrink-0"
                    onClick={() => copyBullet(s._id, `Completed "${s.quest?.title}" for ${s.quest?.course}, earning ${s.awardedPoints} bounty points on faculty review.`)}
                  >
                    {copiedId === s._id ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
