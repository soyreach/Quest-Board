"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Award, Check, Copy, Download, FileText, Gift, MessageSquareText, Paperclip, RotateCcw, Upload } from "lucide-react";
import { MAX_TIER_POINTS, barSegments, bonusEarned, currentTier, nextTier } from "@/lib/tiers";
import { spendablePoints } from "@/lib/shop";
import { useLingering } from "@/lib/useLingering";
import { downloadCertificatePdf } from "@/lib/certificatePdf";
import ResubmitDialog from "@/components/ResubmitDialog";
import { filesOf } from "@/lib/submissionFiles";

// Words and colors for each stage, so the status reads at a glance.
const STATUS_LABEL = { Submitted: "Awaiting review", AI_PreChecked: "Awaiting review", Needs_Revision: "Needs revision" };
const STATUS_STYLE = { Submitted: "badge-info", AI_PreChecked: "badge-info", Needs_Revision: "badge-warn" };

const EVENT_LABEL = {
  submitted: "Turned in",
  resubmitted: "Resubmitted",
  revision_requested: "Revision requested",
  approved: "Approved",
};
const EVENT_ICON = { submitted: Upload, resubmitted: RotateCcw, revision_requested: MessageSquareText, approved: Check };
// How many timeline entries a card shows before "Show earlier".
const TIMELINE_PREVIEW = 3;

function formatWhen(date) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// A submission's timeline. Ones made before history was recorded get a
// best-effort timeline rebuilt from what the submission shows now.
function eventsFor(s) {
  if (s.history?.length) {
    return s.history.map((h) => ({
      ...h,
      key: h._id,
      files: filesOf(h).map((f, i) => ({ name: f.name, href: `/api/submissions/${s._id}/download?entry=${h._id}&file=${i}` })),
      feedbackHref: h.feedbackFileUrl ? `/api/submissions/${s._id}/download?entry=${h._id}&which=feedback` : null,
    }));
  }
  const events = [{
    key: `${s._id}-submitted`,
    type: "submitted",
    at: s.createdAt,
    files: filesOf(s).map((f, i) => ({ name: f.name, href: `/api/submissions/${s._id}/download?file=${i}` })),
  }];
  if (s.status === "Needs_Revision" || s.status === "Professor_Approved") {
    events.push({
      key: `${s._id}-review`,
      type: s.status === "Professor_Approved" ? "approved" : "revision_requested",
      at: s.updatedAt,
      note: s.professorFeedback,
      points: s.awardedPoints,
      feedbackFileName: s.professorFeedbackFileName,
      feedbackHref: s.professorFeedbackFileUrl ? `/api/submissions/${s._id}/download?which=feedback` : null,
    });
  }
  return events;
}

// Turning a quest in from the board more than once creates separate
// submissions, so gather them per quest: one card, one merged timeline.
function groupByQuest(submissions) {
  const byQuest = new Map();
  for (const s of submissions) {
    const key = s.quest?._id || s._id;
    if (!byQuest.has(key)) byQuest.set(key, []);
    byQuest.get(key).push(s);
  }
  return [...byQuest.entries()]
    .map(([key, list]) => {
      const newestFirst = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      // An approval settles the quest; otherwise the latest turn-in is the live one.
      const current = newestFirst.find((s) => s.status === "Professor_Approved") || newestFirst[0];
      const events = newestFirst.flatMap(eventsFor).sort((a, b) => new Date(b.at) - new Date(a.at));
      const attempts = events.filter((e) => e.type === "submitted" || e.type === "resubmitted").length;
      return { key, quest: current.quest, current, submissions: newestFirst, events, attempts };
    })
    .sort((a, b) => new Date(b.events[0]?.at || 0) - new Date(a.events[0]?.at || 0));
}

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
  const resubmitShown = useLingering(resubmitFor);
  const [flash, setFlash] = useState("");
  const [expanded, setExpanded] = useState({});

  // Approved quests always live under Completed. Everything else is either still
  // in progress or, if the student tucked it away, in the Archive.
  const groups = useMemo(() => groupByQuest(submissions), [submissions]);
  const completed = groups.filter((g) => g.current.status === "Professor_Approved");
  const pending = groups.filter((g) => g.current.status !== "Professor_Approved" && !g.current.archivedByStudent);
  const archived = groups.filter((g) => g.current.status !== "Professor_Approved" && g.current.archivedByStudent);

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

  // Moves a quest into or out of the Archive. Every open submission for it moves
  // together, so the quest can't end up half archived. The list updates right
  // away and rolls back if the server says no.
  async function setArchived(group, value) {
    setArchiveError("");
    const ids = group.submissions.filter((s) => s.status !== "Professor_Approved").map((s) => s._id);
    const apply = (flag) =>
      setSubmissions((list) => list.map((s) => (ids.includes(s._id) ? { ...s, archivedByStudent: flag } : s)));
    apply(value);
    try {
      await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`/api/submissions/${id}/archive`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: value }),
          });
          if (!res.ok) {
            const { error } = await res.json().catch(() => ({}));
            throw new Error(error || "Could not update this quest. Try again.");
          }
        })
      );
    } catch (err) {
      apply(!value);
      setArchiveError(err.message || "Could not update this quest. Try again.");
    }
  }

  function renderTimeline(group) {
    const open = expanded[group.key];
    const shown = open ? group.events : group.events.slice(0, TIMELINE_PREVIEW);
    const hidden = group.events.length - shown.length;
    return (
      <div className="mt-4">
        <div className="text-[0.7rem] font-bold tracking-wider uppercase text-[var(--ink)]/60 mb-2">History</div>
        <ol className="timeline">
          {shown.map((e, i) => {
            const Icon = EVENT_ICON[e.type] || Upload;
            const isReview = e.type === "revision_requested" || e.type === "approved";
            // The newest revision request is what the student has to act on.
            const urgent = i === 0 && e.type === "revision_requested" && group.current.status === "Needs_Revision";
            return (
              <li key={e.key} className={`timeline-item ${isReview ? "review" : ""} ${e.type === "approved" ? "approved" : ""}`}>
                <span className="timeline-dot" aria-hidden="true"><Icon size={11} strokeWidth={2.5} /></span>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold">{EVENT_LABEL[e.type]}</span>
                  {e.type === "approved" && e.points > 0 && (
                    <span className="text-xs font-bold text-gold-ink tabular-nums">+{e.points}</span>
                  )}
                  <span className="meta">{formatWhen(e.at)}</span>
                </div>
                {e.files?.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 mt-0.5">
                    {e.files.map((f) => (
                      <a key={f.href} href={f.href} className="file-link">
                        <FileText size={13} aria-hidden="true" /> {f.name}
                      </a>
                    ))}
                  </div>
                )}
                {isReview && (e.note || e.feedbackHref) && (
                  <div className={`timeline-note ${urgent ? "urgent" : ""}`}>
                    {e.note && <p className="text-sm whitespace-pre-line">{e.note}</p>}
                    {e.feedbackHref && (
                      <a href={e.feedbackHref} className="file-link mt-1">
                        <Paperclip size={13} aria-hidden="true" /> {e.feedbackFileName}
                      </a>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {group.events.length > TIMELINE_PREVIEW && (
          <button
            type="button"
            className="quiet-btn mt-1 -ml-2"
            aria-expanded={Boolean(open)}
            onClick={() => setExpanded((x) => ({ ...x, [group.key]: !open }))}
          >
            {open ? "Show less" : `Show ${hidden} earlier update${hidden === 1 ? "" : "s"}`}
          </button>
        )}
      </div>
    );
  }

  function renderHeader(group, badge) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{group.quest?.title || "Removed quest"}</div>
          <div className="meta">
            {group.quest?.course}
            {group.attempts > 1 && ` · ${group.attempts} attempts`}
          </div>
        </div>
        {badge}
      </div>
    );
  }

  function renderCard(group, inArchive) {
    const s = group.current;
    const needsRevision = s.status === "Needs_Revision";
    return (
      <div key={group.key} className="row">
        {renderHeader(
          group,
          <span className={`badge shrink-0 ${STATUS_STYLE[s.status] || "badge-quiet"}`}>
            {STATUS_LABEL[s.status] || s.status.replace("_", " ")}
          </span>
        )}

        {renderTimeline(group)}

        <div className="flex flex-wrap items-center justify-end gap-1 mt-3 pt-3 border-t border-dashed border-[color:var(--line)]">
          {inArchive ? (
            <button type="button" onClick={() => setArchived(group, false)} className="quiet-btn">
              <RotateCcw size={14} aria-hidden="true" /> Restore
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setArchived(group, true)}
                aria-label={`Move "${group.quest?.title}" to Archive`}
                className="quiet-btn"
              >
                <Archive size={14} aria-hidden="true" /> Archive
              </button>
              <button
                type="button"
                className={`btn btn-sm ${needsRevision ? "btn-primary" : "btn-outline"}`}
                onClick={() => setResubmitFor(s)}
              >
                Resubmit
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  function renderCompleted(group) {
    const s = group.current;
    const bullet = `Completed "${s.quest?.title}" for ${s.quest?.course}, earning ${s.awardedPoints} bounty points on faculty review.`;
    return (
      <div key={group.key} className="row">
        {renderHeader(
          group,
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-gold-ink tabular-nums">+{s.awardedPoints}</span>
            <span className="badge badge-ok">Approved</span>
          </div>
        )}
        {renderTimeline(group)}
        <div className="mt-3 rounded-[10px] bg-[var(--lavender)] p-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[0.7rem] font-bold tracking-wider uppercase text-[var(--ink)]/60 mb-0.5">Line for your CV</div>
            <p className="text-sm">{bullet}</p>
          </div>
          <button type="button" className="quiet-btn shrink-0" onClick={() => copyBullet(s._id, bullet)}>
            {copiedId === s._id ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copiedId === s._id ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    );
  }

  const TABS = [
    ["progress", "In progress", pending.length],
    ["done", "Completed", completed.length],
    ["archive", "Archive", archived.length],
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-24 page-enter">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `conic-gradient(${tier?.color || "var(--wood)"} ${pct}%, var(--line) 0)` }}
            aria-hidden="true"
          >
            <div className="w-[52px] h-[52px] rounded-full bg-[var(--board)] flex items-center justify-center text-xs font-bold tabular-nums">{pct}%</div>
          </div>
          <div>
            <div className="hub-eyebrow">Student hub</div>
            <h1 className="font-display font-bold text-3xl leading-tight">{me?.name || userName}</h1>
            <p className="meta">{userEmail}</p>
          </div>
        </div>
        <Link href="/board" className="btn btn-primary">Browse the board</Link>
      </header>

      <div className="stat-strip grid-cols-4 mb-8">
        <div>
          <div className="stat-label">Bounty points</div>
          <div className="stat-value">{points.toLocaleString("en-US")}</div>
          <Link href="/shop" className="file-link mt-1 text-xs">
            {spendablePoints(me).toLocaleString("en-US")} to spend in the shop
          </Link>
        </div>
        <div>
          <div className="stat-label">Current tier</div>
          <div className="stat-value flex items-center gap-2">
            {tier && <span className="w-2.5 h-2.5 rounded-full" style={{ background: tier.color }} aria-hidden="true" />}
            {tier ? tier.name : <span className="text-[var(--ink)]/50">None yet</span>}
          </div>
        </div>
        <div>
          <div className="stat-label">In progress</div>
          <div className="stat-value">{pending.length}</div>
        </div>
        <div>
          <div className="stat-label">Completed</div>
          <div className="stat-value">{completed.length}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <section aria-label="Your quests">
          {flash && (
            <p role="status" className="mb-4 rounded-xl bg-[var(--indigo-soft)] border border-[color:var(--line)] px-4 py-3 text-sm">
              {flash}
            </p>
          )}

          <div className="folder-tabs" role="tablist">
            {TABS.map(([key, label, count]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className={`folder-tab inline-flex items-center gap-2 ${tab === key ? "active" : ""}`}
                onClick={() => setTab(key)}
              >
                {label} <span className="count-pill">{count}</span>
              </button>
            ))}
          </div>

          <div key={tab} className="folder-panel tab-fade">
            {archiveError && <p className="text-xs text-red-600 px-5 pt-4">{archiveError}</p>}

            {tab === "progress" && (
              pending.length === 0 ? (
                <p className="empty-note">
                  Nothing in progress. <Link href="/board" className="underline text-[var(--ink)]">Pick a quest from the board</Link>.
                </p>
              ) : (
                <div className="row-list">{pending.map((g) => renderCard(g, false))}</div>
              )
            )}

            {tab === "done" && (
              completed.length === 0 ? (
                <p className="empty-note">No approved quests yet. They land here once your professor signs them off.</p>
              ) : (
                <div className="row-list">{completed.map(renderCompleted)}</div>
              )
            )}

            {tab === "archive" && (
              archived.length === 0 ? (
                <p className="empty-note">Nothing archived. Use Archive on a quest in progress to tuck it away here.</p>
              ) : (
                <div className="row-list">
                  <p className="row meta">
                    Archived quests are hidden from In progress. Your professor can still see them, and a new revision request or approval brings a quest back.
                  </p>
                  {archived.map((g) => renderCard(g, true))}
                </div>
              )
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="hub-card">
            <div className="hub-card-head">
              <h2 className="hub-card-title">Certificate progress</h2>
              <span className="meta tabular-nums">{points.toLocaleString("en-US")} / {MAX_TIER_POINTS.toLocaleString("en-US")}</span>
            </div>
            <div className="p-5">
              <div
                role="progressbar"
                aria-label="Certificate progress"
                aria-valuemin={0}
                aria-valuemax={MAX_TIER_POINTS}
                aria-valuenow={Math.min(points, MAX_TIER_POINTS)}
                className="flex gap-1 mb-5"
              >
                {segments.map((seg) => (
                  <div key={seg.name} style={{ flex: seg.span }} className="h-2 rounded-full overflow-hidden bg-black/[0.08]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${seg.fraction * 100}%`, background: seg.gradient, transition: "width 1s var(--ease-out)" }}
                    />
                  </div>
                ))}
              </div>

              <ol className="space-y-3">
                {segments.map((seg) => (
                  <li key={seg.name} className="flex items-center gap-3">
                    <span
                      className="w-7 h-7 rounded-full grid place-content-center text-[0.7rem] font-bold shrink-0"
                      style={seg.reached ? { background: seg.color, color: "#FDFBD4" } : { border: `1.5px dashed ${seg.color}`, color: seg.color }}
                      aria-hidden="true"
                    >
                      {seg.reached ? <Check size={14} strokeWidth={3} /> : seg.name[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${seg.reached ? "font-semibold" : "font-medium"}`}>{seg.name}</div>
                      <div className="meta">
                        {seg.at.toLocaleString("en-US")} pts{seg.bonus ? ` · +${seg.bonus} bonus` : ""}
                      </div>
                    </div>
                    <span className="text-xs font-medium tabular-nums text-[var(--ink)]/70 shrink-0">
                      {seg.reached ? "Reached" : `${(seg.at - points).toLocaleString("en-US")} to go`}
                    </span>
                  </li>
                ))}
              </ol>

              <p className="meta mt-5 pt-4 border-t border-[color:var(--line)]">
                {upNext
                  ? `Next up: ${upNext.name}${upNext.bonus ? `, with ${upNext.bonus} bonus points` : ""}.`
                  : "You've reached Gold, the top tier."}
                {bonusPoints > 0 && ` Your total includes ${bonusPoints} tier bonus points.`}
              </p>
            </div>
          </div>

          <div className="hub-card">
            <div className="hub-card-head">
              <h2 className="hub-card-title">Certificates &amp; rewards</h2>
              <span className="count-pill">{awards.length}</span>
            </div>
            {awards.length === 0 ? (
              <p className="empty-note">Reach Gold and the school committee will sign your certificate here.</p>
            ) : (
              <div className="row-list">
                {awards.map((a) => {
                  const Icon = a.type === "certificate" ? Award : Gift;
                  return (
                    <div key={a._id} className="row flex items-start gap-3">
                      <span className="w-8 h-8 rounded-full bg-[var(--lavender)] grid place-content-center shrink-0 text-[var(--wood)]" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{a.type === "certificate" ? "Certificate of Appreciation" : a.reward}</div>
                        <div className="meta">
                          {a.type === "certificate" ? `${a.certId} · ` : ""}
                          {new Date(a.issuedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                        </div>
                        {a.type === "certificate" && a.reward && <div className="meta">Reward: {a.reward}</div>}
                        {a.note && <p className="text-sm italic text-[var(--ink)]/70 mt-1">&ldquo;{a.note}&rdquo;</p>}
                        {a.type === "certificate" && (
                          <button className="btn btn-primary btn-sm mt-3" onClick={() => downloadPdf(a)} disabled={pdfBusy === a._id}>
                            <Download size={14} aria-hidden="true" />
                            {pdfBusy === a._id ? "Preparing…" : "Download PDF"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {pdfError && <p className="text-xs text-red-600 px-5 pb-4">{pdfError}</p>}
          </div>
        </aside>
      </div>

      {resubmitShown && (
        <ResubmitDialog
          key={resubmitShown._id}
          open={Boolean(resubmitFor)}
          submission={resubmitShown}
          onClose={() => setResubmitFor(null)}
          onResubmitted={handleResubmitted}
        />
      )}
    </div>
  );
}
