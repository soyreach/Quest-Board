"use client";

import { useState } from "react";
import { MAX_TIER_POINTS, barSegments, bonusEarned, currentTier, nextTier } from "@/lib/tiers";
import { downloadCertificatePdf } from "@/lib/certificatePdf";
import ResubmitDialog from "@/components/ResubmitDialog";

// Words and colors for each stage, so the status reads at a glance.
const STATUS_LABEL = { Submitted: "Awaiting review", AI_PreChecked: "Awaiting review", Needs_Revision: "Needs revision" };
const STATUS_STYLE = { Submitted: "badge-info", AI_PreChecked: "badge-info", Needs_Revision: "badge-warn" };

export default function StudentDashboardClient({ initialMe, initialSubmissions, initialAwards = [], userName, userEmail }) {
  const [me] = useState(initialMe);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [tab, setTab] = useState("progress");
  const [copiedId, setCopiedId] = useState(null);
  const [archiveError, setArchiveError] = useState("");
  const [awards] = useState(initialAwards);
  const [pdfBusy, setPdfBusy] = useState(null);
  const [pdfError, setPdfError] = useState("");
  const [resubmitFor, setResubmitFor] = useState(null);
  const [flash, setFlash] = useState("");

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

  async function downloadPdf(award) {
    setPdfError("");
    setPdfBusy(award._id);
    try {
      await downloadCertificatePdf(award);
    } catch {
      setPdfError("Couldn't prepare the PDF. Check your connection and try again.");
    } finally {
      setPdfBusy(null);
    }
  }

  // The dialog calls this with the updated submission once the upload succeeds.
  function handleResubmitted(updated) {
    setSubmissions((list) => list.map((s) => (s._id === updated._id ? updated : s)));
    setResubmitFor(null);
    setFlash(`"${updated.quest?.title}" was resubmitted. Your professor has been notified.`);
    setTimeout(() => setFlash(""), 6000);
  }

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
      <div key={s._id} className="p-4 rounded-xl bg-[var(--lavender)]">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="font-medium">{s.quest?.title}</div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`badge ${STATUS_STYLE[s.status] || "badge-quiet"}`}>{STATUS_LABEL[s.status] || s.status.replace("_", " ")}</span>
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
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm text-[var(--ink)]/70 hover:text-[var(--ink)] hover:bg-[var(--paper)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--indigo)]"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="text-xs text-[var(--ink)]/70 mb-2">{s.quest?.course}</div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {s.fileUrl ? (
            <a href={`/api/submissions/${s._id}/download`} className="text-sm underline text-[var(--indigo)] break-all">
              📄 {s.fileName}
            </a>
          ) : (
            <span />
          )}
          {!inArchive && (
            <button
              type="button"
              className={`btn btn-sm ${s.status === "Needs_Revision" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setResubmitFor(s)}
            >
              Resubmit
            </button>
          )}
        </div>
        {s.status === "Needs_Revision" && s.professorFeedback && (
          <p className="text-sm text-[var(--ink)]/70 italic mt-2">&quot;{s.professorFeedback}&quot;</p>
        )}
        {s.status === "Needs_Revision" && s.professorFeedbackFileUrl && (
          <a href={`/api/submissions/${s._id}/download?which=feedback`} className="text-xs underline text-[var(--indigo)] block mt-1">
            📎 {s.professorFeedbackFileName}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-10 pb-24 page-enter">
      <div className="bg-[var(--paper)] rounded-[14px] shadow-paper p-6 md:p-8 mb-6 flex flex-wrap items-center gap-6">
        <div
          className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
          style={{ background: `conic-gradient(var(--wood) ${pct}%, var(--line) 0)` }}
        >
          <div className="w-14 h-14 rounded-full bg-[var(--paper)] flex items-center justify-center text-sm font-bold">{pct}%</div>
        </div>
        <div>
          <div className="badge bg-[var(--lavender)] border border-[color:var(--line)] mb-2">
            {tier && <span className="w-2 h-2 rounded-full" style={{ background: tier.color }} />}
            {tier ? `${tier.name} tier` : "No tier yet"}
          </div>
          <h1 className="font-display font-semibold text-2xl">{me?.name || userName}</h1>
          <p className="text-[var(--ink)]/70 text-sm">{userEmail}</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[var(--ink)]/70 text-xs mb-1">Total bounty points</div>
          <div className="font-display font-bold text-4xl">{points}</div>
        </div>
      </div>

      <div className="bg-[var(--paper)] rounded-[14px] shadow-paper p-6 md:p-8 mb-8">
        <div className="flex flex-wrap justify-between gap-2 text-sm mb-3">
          <span className="font-medium">Certificate progress</span>
          <span className="text-[var(--ink)]/70">
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
              className={`flex items-center justify-end gap-1.5 text-xs ${seg.reached ? "text-[var(--ink)] font-medium" : "text-[var(--ink)]/70"}`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color, opacity: seg.reached ? 1 : 0.45 }} />
              <span className="truncate">
                {seg.name} {seg.at.toLocaleString("en-US")}
                {seg.reached ? " ✓" : ""}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--ink)]/70 mt-4">
          {upNext
            ? `${(upNext.at - points).toLocaleString("en-US")} points to ${upNext.name}${upNext.bonus ? `, which comes with ${upNext.bonus} bonus points.` : "."}`
            : "You've reached Gold, the top tier."}
          {bonusPoints > 0 && ` Your total includes ${bonusPoints} tier bonus points.`}
        </p>
      </div>

      {awards.length > 0 && (
        <div className="bg-[var(--paper)] rounded-[14px] shadow-paper p-6 md:p-8 mb-8">
          <div className="font-medium mb-4">Certificates &amp; rewards</div>
          <div className="space-y-3">
            {awards.map((a) => (
              <div key={a._id} className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-[var(--lavender)]">
                <span aria-hidden="true" className="text-xl">{a.type === "certificate" ? "🎓" : "🎁"}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{a.type === "certificate" ? "Certificate of Appreciation" : a.reward}</div>
                  <div className="text-xs text-[var(--ink)]/70">
                    {a.type === "certificate" ? `${a.certId} · ` : ""}
                    {new Date(a.issuedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                    {a.type === "certificate" && a.reward ? ` · Reward: ${a.reward}` : ""}
                  </div>
                  {a.note && <p className="text-sm italic text-[var(--ink)]/70 mt-1">&quot;{a.note}&quot;</p>}
                </div>
                {a.type === "certificate" && (
                  <button className="btn btn-primary btn-sm" onClick={() => downloadPdf(a)} disabled={pdfBusy === a._id}>
                    {pdfBusy === a._id ? "Preparing…" : "Download PDF"}
                  </button>
                )}
              </div>
            ))}
          </div>
          {pdfError && <p className="text-xs text-red-600 mt-3">{pdfError}</p>}
        </div>
      )}

      {flash && (
        <p role="status" className="mb-4 rounded-xl bg-[var(--indigo-soft)] border border-[color:var(--line)] px-4 py-3 text-sm">
          {flash}
        </p>
      )}

      <div>
        <div className="folder-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "progress"} className={`folder-tab ${tab === "progress" ? "active" : ""}`} onClick={() => setTab("progress")}>In progress</button>
          <button role="tab" aria-selected={tab === "done"} className={`folder-tab ${tab === "done" ? "active" : ""}`} onClick={() => setTab("done")}>Completed</button>
          <button role="tab" aria-selected={tab === "archive"} className={`folder-tab ${tab === "archive" ? "active" : ""}`} onClick={() => setTab("archive")}>
            Archive{archived.length > 0 ? ` (${archived.length})` : ""}
          </button>
        </div>

        <div className="folder-panel">
        {archiveError && <p className="text-xs text-red-600 px-6 pt-4">{archiveError}</p>}

        {tab === "progress" && (
          <div className="p-6 space-y-3">
            {pending.length === 0 && <p className="text-sm text-[var(--ink)]/70">Nothing pending — head to the board to pick up a quest.</p>}
            {pending.map((s) => renderCard(s, false))}
          </div>
        )}

        {tab === "done" && (
          <div className="p-6 space-y-4">
            {completed.length === 0 && <p className="text-sm text-[var(--ink)]/70">No approved quests yet.</p>}
            {completed.map((s) => (
              <div key={s._id} className="p-4 rounded-xl border border-black/5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium">{s.quest?.title}</div>
                    <div className="text-xs text-[var(--ink)]/70">{s.quest?.course} · +{s.awardedPoints} pts</div>
                  </div>
                  <span className="badge bg-emerald-50 text-emerald-700">Approved</span>
                </div>
                {s.professorFeedback && (
                  <p className="text-sm text-[var(--ink)]/70 italic mb-1">&quot;{s.professorFeedback}&quot;</p>
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
              <p className="text-sm text-[var(--ink)]/70">
                Nothing archived. Use the ✕ on a quest in progress to tuck it away here.
              </p>
            ) : (
              <>
                <p className="text-xs text-[var(--ink)]/70">
                  Archived quests are hidden from In progress. Your professor can still see them, and a new revision request or approval brings a quest back.
                </p>
                {archived.map((s) => renderCard(s, true))}
              </>
            )}
          </div>
        )}
        </div>
      </div>
      {resubmitFor && (
        <ResubmitDialog
          submission={resubmitFor}
          onClose={() => setResubmitFor(null)}
          onResubmitted={handleResubmitted}
        />
      )}
    </div>
  );
}
