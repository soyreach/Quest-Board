"use client";

import { useState } from "react";
import { MAX_TIER_POINTS, barSegments, bonusEarned, currentTier, nextTier } from "@/lib/tiers";

export default function StudentDashboardClient({ initialMe, initialSubmissions, userName, userEmail }) {
  const [me] = useState(initialMe);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [tab, setTab] = useState("progress");
  const [copiedId, setCopiedId] = useState(null);
  const [archiveError, setArchiveError] = useState("");

  // Approved work always lives under Completed. Everything else is either still
  // in progress or, if the student tucked it away, in the Archive.
  const completed = submissions.filter((s) => s.status === "Professor_Approved");
  const pending = submissions.filter((s) => s.status !== "Professor_Approved" && !s.archivedByStudent);
  const archived = submissions.filter((s) => s.status !== "Professor_Approved" && s.archivedByStudent);

  const points = me?.bountyPoints ?? 0;
  const pct = Math.min(100, Math.round((points / MAX_TIER_POINTS) * 100));
  const tier = currentTier(points);
  const upNext = nextTier(points);
  const segments = barSegments(points);
  const bonusPoints = bonusEarned(me?.tiersReached);

  function copyBullet(id, text) {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1400);
  }

  // Moves a submission into or out of the Archive. The list updates right away
  // and rolls back if the server says no.
  async function setArchived(id, value) {
    setArchiveError("");
    const apply = (flag) =>
      setSubmissions((list) => list.map((s) => (s._id === id ? { ...s, archivedByStudent: flag } : s)));
    apply(value);
    try {
      const res = await fetch(`/api/submissions/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: value }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || "Could not update this quest. Try again.");
      }
    } catch (err) {
      apply(!value);
      setArchiveError(err.message || "Could not update this quest. Try again.");
    }
  }

  function renderCard(s, inArchive) {
    return (
      <div key={s._id} className="p-4 rounded-2xl bg-[var(--lavender)]">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="font-medium">{s.quest?.title}</div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="badge bg-white text-[var(--ink)]/60">{s.status.replace("_", " ")}</span>
            {inArchive ? (
              <button
                type="button"
                onClick={() => setArchived(s._id, false)}
                className="btn btn-sm btn-light border border-black/10"
              >
                Restore
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setArchived(s._id, true)}
                aria-label={`Move "${s.quest?.title}" to Archive`}
                title="Move to Archive"
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm text-[var(--ink)]/35 hover:text-[var(--ink)] hover:bg-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--indigo)]"
              >
                ✕
              </button>
            )}
          </div>
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
    );
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
            <div className="badge bg-white/15 mb-2">
              {tier && <span className="w-2 h-2 rounded-full" style={{ background: tier.color }} />}
              {tier ? `${tier.name} tier` : "No tier yet"}
            </div>
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
        <div className="flex flex-wrap justify-between gap-2 text-sm mb-3">
          <span className="font-medium">Certificate progress</span>
          <span className="text-[var(--ink)]/50">
            {points.toLocaleString("en-US")} / {MAX_TIER_POINTS.toLocaleString("en-US")} pts
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="Certificate progress"
          aria-valuemin={0}
          aria-valuemax={MAX_TIER_POINTS}
          aria-valuenow={Math.min(points, MAX_TIER_POINTS)}
          className="flex gap-1"
        >
          {segments.map((seg) => (
            <div key={seg.name} style={{ flex: seg.span }} className="h-2.5 rounded-full overflow-hidden bg-black/[0.08]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${seg.fraction * 100}%`,
                  background: seg.gradient,
                  transition: "width 1s cubic-bezier(.22,1,.36,1)",
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-1 mt-2">
          {segments.map((seg) => (
            <div
              key={seg.name}
              style={{ flex: seg.span }}
              className={`flex items-center justify-end gap-1.5 text-xs ${seg.reached ? "text-[var(--ink)] font-medium" : "text-[var(--ink)]/45"}`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color, opacity: seg.reached ? 1 : 0.45 }} />
              <span className="truncate">
                {seg.name} {seg.at.toLocaleString("en-US")}
                {seg.reached ? " ✓" : ""}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--ink)]/55 mt-4">
          {upNext
            ? `${(upNext.at - points).toLocaleString("en-US")} points to ${upNext.name}${upNext.bonus ? `, which comes with ${upNext.bonus} bonus points.` : "."}`
            : "You've reached Gold, the top tier."}
          {bonusPoints > 0 && ` Your total includes ${bonusPoints} tier bonus points.`}
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-[0_10px_30px_-20px_rgba(20,18,43,0.4)] overflow-hidden">
        <div className="flex gap-8 px-6 pt-5 border-b border-black/5">
          <button className={`tab-btn ${tab === "progress" ? "active" : ""}`} onClick={() => setTab("progress")}>In progress</button>
          <button className={`tab-btn ${tab === "done" ? "active" : ""}`} onClick={() => setTab("done")}>Completed</button>
          <button className={`tab-btn ${tab === "archive" ? "active" : ""}`} onClick={() => setTab("archive")}>
            Archive{archived.length > 0 ? ` (${archived.length})` : ""}
          </button>
        </div>

        {archiveError && <p className="text-xs text-red-600 px-6 pt-4">{archiveError}</p>}

        {tab === "progress" && (
          <div className="p-6 space-y-3">
            {pending.length === 0 && <p className="text-sm text-[var(--ink)]/50">Nothing pending — head to the board to pick up a quest.</p>}
            {pending.map((s) => renderCard(s, false))}
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

        {tab === "archive" && (
          <div className="p-6 space-y-3">
            {archived.length === 0 ? (
              <p className="text-sm text-[var(--ink)]/50">
                Nothing archived. Use the ✕ on a quest in progress to tuck it away here.
              </p>
            ) : (
              <>
                <p className="text-xs text-[var(--ink)]/45">
                  Archived quests are hidden from In progress. Your professor can still see them, and a new revision request or approval brings a quest back.
                </p>
                {archived.map((s) => renderCard(s, true))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
