"use client";

import { useState } from "react";
import { Award, Download, Gift } from "lucide-react";
import { MAX_TIER_POINTS, currentTier } from "@/lib/tiers";
import { downloadCertificatePdf } from "@/lib/certificatePdf";

const REWARD_IDEAS = ["Campus bookstore voucher", "Quest Board merch pack", "Lunch with the faculty"];

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function CommitteeDashboardClient({ initialStudents, initialAwards, signerName }) {
  const [students] = useState(initialStudents);
  const [awards, setAwards] = useState(initialAwards);
  const [tab, setTab] = useState("ready");
  const [dialog, setDialog] = useState(null); // { mode: "certificate" | "reward", student }
  const [recipientName, setRecipientName] = useState("");
  const [reward, setReward] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [busyId, setBusyId] = useState(null);

  const nameById = Object.fromEntries(students.map((s) => [s._id, s.name]));
  const certified = new Set(awards.filter((a) => a.type === "certificate").map((a) => a.student));
  const ready = students.filter((s) => s.bountyPoints >= MAX_TIER_POINTS && !certified.has(s._id));
  const earning = students.filter((s) => s.bountyPoints < MAX_TIER_POINTS);
  const certCount = awards.filter((a) => a.type === "certificate").length;
  const rewardCount = awards.length - certCount;

  function openDialog(mode, student) {
    setDialog({ mode, student });
    setRecipientName(student.name);
    setReward("");
    setNote("");
    setError("");
  }
  const closeDialog = () => setDialog(null);

  function say(message) {
    setFlash(message);
    setTimeout(() => setFlash(""), 6000);
  }

  async function submit(e) {
    e.preventDefault();
    if (!dialog) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/committee/awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: dialog.mode,
          studentId: dialog.student._id,
          recipientName,
          reward,
          note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      setAwards((list) => [data, ...list]);
      say(
        dialog.mode === "certificate"
          ? `Certificate issued to ${dialog.student.name}. They've been notified and can download the PDF.`
          : `Reward sent to ${dialog.student.name}. They've been notified.`
      );
      setDialog(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function previewPdf() {
    setBusyId("preview");
    try {
      await downloadCertificatePdf({
        recipientName: recipientName.trim() || dialog.student.name,
        signerName,
        signerTitle: "School Committee",
        certId: "PREVIEW",
        issuedAt: new Date().toISOString(),
      });
    } catch {
      setError("Couldn't build the preview. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function downloadAward(a) {
    setBusyId(a._id);
    try {
      await downloadCertificatePdf(a);
    } catch {
      say("Couldn't prepare that PDF. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  function studentRow(s, canIssue) {
    const tier = currentTier(s.bountyPoints);
    const toGold = Math.min(100, Math.round((s.bountyPoints / MAX_TIER_POINTS) * 100));
    return (
      <div key={s._id} className="row grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_150px_auto] md:items-center">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-full bg-[var(--lavender)] grid place-content-center text-sm font-bold shrink-0" aria-hidden="true">
            {(s.name || "?")[0].toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="font-medium truncate">{s.name}</div>
            <div className="meta truncate">@{s.username} · {s.email}</div>
          </div>
        </div>
        <div>
          <span className="badge badge-quiet">
            {tier && <span className="w-2 h-2 rounded-full" style={{ background: tier.color }} aria-hidden="true" />}
            {tier ? tier.name : "No tier yet"}
          </span>
        </div>
        <div>
          <div className="text-sm font-semibold tabular-nums">
            {s.bountyPoints.toLocaleString("en-US")} <span className="font-normal text-[var(--ink)]/60">pts</span>
          </div>
          {!canIssue && (
            <div className="h-1.5 rounded-full bg-black/[0.08] mt-1.5 overflow-hidden" aria-label={`${toGold}% of the way to Gold`}>
              <div className="h-full rounded-full" style={{ width: `${toGold}%`, background: tier?.color || "var(--wood)" }} />
            </div>
          )}
        </div>
        <div className="flex gap-2 md:justify-end">
          {canIssue && (
            <button className="btn btn-primary btn-sm" onClick={() => openDialog("certificate", s)}>
              <Award size={14} aria-hidden="true" /> Issue certificate
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => openDialog("reward", s)}>
            <Gift size={14} aria-hidden="true" /> Send reward
          </button>
        </div>
      </div>
    );
  }

  const columnHeads = (
    <div className="hidden md:grid grid-cols-[minmax(0,1fr)_110px_150px_auto] gap-3 px-5 py-2.5 bg-[var(--lavender)] text-[0.7rem] font-bold tracking-wider uppercase text-[var(--ink)]/60">
      <span>Student</span><span>Tier</span><span>Points</span><span className="text-right">Actions</span>
    </div>
  );

  const TABS = [
    ["ready", "Ready to issue", ready.length],
    ["earning", "Still earning", earning.length],
    ["history", "History", awards.length],
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-24 page-enter">
      <header className="mb-6">
        <div className="hub-eyebrow">Committee hub</div>
        <h1 className="font-display font-bold text-3xl leading-tight">Certificates &amp; rewards</h1>
        <p className="meta mt-1 max-w-xl">
          Students who reach Gold ({MAX_TIER_POINTS.toLocaleString("en-US")} points) are ready for a certificate. You can send
          a reward to anyone. Students are notified straight away.
        </p>
      </header>

      <div className="stat-strip grid-cols-4 mb-8">
        {[
          [ready.length, "Ready to issue"],
          [earning.length, "Still earning"],
          [certCount, "Certificates issued"],
          [rewardCount, "Rewards sent"],
        ].map(([n, label]) => (
          <div key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{n}</div>
          </div>
        ))}
      </div>

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

      <div className="folder-panel">
        {tab === "ready" &&
          (ready.length === 0 ? (
            <p className="empty-note">No one is waiting. Students appear here the moment they reach Gold.</p>
          ) : (
            <>
              {columnHeads}
              <div className="row-list">{ready.map((s) => studentRow(s, true))}</div>
            </>
          ))}

        {tab === "earning" &&
          (earning.length === 0 ? (
            <p className="empty-note">Every student has reached Gold.</p>
          ) : (
            <>
              {columnHeads}
              <div className="row-list">{earning.map((s) => studentRow(s, false))}</div>
            </>
          ))}

        {tab === "history" &&
          (awards.length === 0 ? (
            <p className="empty-note">Nothing issued yet.</p>
          ) : (
            <div className="row-list">
              {awards.map((a) => {
                const Icon = a.type === "certificate" ? Award : Gift;
                return (
                  <div key={a._id} className="row flex flex-wrap items-start gap-3">
                    <span className="w-9 h-9 rounded-full bg-[var(--lavender)] grid place-content-center shrink-0 text-[var(--wood)]" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {a.type === "certificate" ? `Certificate · ${a.recipientName}` : `${a.reward} · ${nameById[a.student] || "Student"}`}
                      </div>
                      <div className="meta">
                        {a.type === "certificate" ? `${a.certId} · ` : ""}
                        {formatDate(a.issuedAt)}
                        {a.type === "certificate" && a.reward ? ` · Reward: ${a.reward}` : ""}
                      </div>
                      {a.note && <p className="text-sm italic text-[var(--ink)]/70 mt-1">&ldquo;{a.note}&rdquo;</p>}
                    </div>
                    {a.type === "certificate" && (
                      <button className="quiet-btn" onClick={() => downloadAward(a)} disabled={busyId === a._id}>
                        <Download size={14} aria-hidden="true" />
                        {busyId === a._id ? "Preparing…" : "Download PDF"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
      </div>

      <div className={`modal-backdrop ${dialog ? "open" : ""}`} onClick={closeDialog}>
        {dialog && (
          <form onSubmit={submit} className="w-[92vw] max-w-md plain-modal p-8 max-h-[86vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-xl mb-1">
              {dialog.mode === "certificate" ? "Issue certificate" : "Send a reward"}
            </h3>
            <p className="text-sm text-[var(--ink)]/70 mb-5">
              {dialog.student.name} · {dialog.student.bountyPoints.toLocaleString("en-US")} points
            </p>

            {dialog.mode === "certificate" && (
              <>
                <label htmlFor="cert-name" className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">Name on the certificate</label>
                <input
                  id="cert-name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  maxLength={80}
                  required
                  className="field mb-1"
                />
                <p className="text-xs text-[var(--ink)]/70 mb-4">Check the spelling: this is printed exactly as written.</p>
              </>
            )}

            <label htmlFor="cert-reward" className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">
              {dialog.mode === "certificate" ? "Reward or gift (optional)" : "Reward"}
            </label>
            <input
              id="cert-reward"
              list="reward-ideas"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              maxLength={120}
              required={dialog.mode === "reward"}
              placeholder="e.g. Campus bookstore voucher"
              className="field mb-4"
            />
            <datalist id="reward-ideas">
              {REWARD_IDEAS.map((r) => <option key={r} value={r} />)}
            </datalist>

            <label htmlFor="cert-note" className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">Note to the student (optional)</label>
            <textarea
              id="cert-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="field mb-1"
            />

            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

            <div className="flex flex-wrap justify-end gap-2 mt-5">
              {dialog.mode === "certificate" && (
                <button type="button" className="btn btn-outline btn-sm mr-auto" onClick={previewPdf} disabled={busyId === "preview"}>
                  {busyId === "preview" ? "Building…" : "Preview PDF"}
                </button>
              )}
              <button type="button" className="btn btn-light btn-sm border border-[color:var(--line)]" onClick={closeDialog}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? "Saving…" : dialog.mode === "certificate" ? "Issue certificate" : "Send reward"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
