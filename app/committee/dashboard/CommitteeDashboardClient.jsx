"use client";

import { useState } from "react";
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
    return (
      <div key={s._id} className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-[var(--lavender)]">
        <div className="min-w-0 flex-1">
          <div className="font-medium">{s.name}</div>
          <div className="text-xs text-[var(--ink)]/50">@{s.username} · {s.email}</div>
        </div>
        <span className="badge bg-[var(--paper)] border border-[color:var(--line)]">
          {tier && <span className="w-2 h-2 rounded-full" style={{ background: tier.color }} />}
          {tier ? tier.name : "No tier yet"}
        </span>
        <div className="font-display font-bold text-lg w-20 text-right">{s.bountyPoints.toLocaleString("en-US")}</div>
        <div className="flex gap-2">
          {canIssue && (
            <button className="btn btn-primary btn-sm" onClick={() => openDialog("certificate", s)}>
              Issue certificate
            </button>
          )}
          <button className="btn btn-light btn-sm border border-[color:var(--line)]" onClick={() => openDialog("reward", s)}>
            Send reward
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 pt-10 pb-24 page-enter">
      <div className="mb-8">
        <span className="text-xs font-bold tracking-widest uppercase text-[var(--ink)]/55">School committee</span>
        <h1 className="font-display font-semibold text-3xl mt-1 mb-1">Certificates &amp; rewards</h1>
        <p className="text-[var(--ink)]/60 max-w-xl">
          Students who reach Gold ({MAX_TIER_POINTS.toLocaleString("en-US")} points) are ready for a certificate. You can also send
          a reward to any student. They are notified straight away, with the certificate attached.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          [ready.length, "Ready to issue"],
          [earning.length, "Still earning"],
          [certCount, "Certificates issued"],
          [rewardCount, "Rewards sent"],
        ].map(([n, label]) => (
          <div key={label} className="bg-[var(--paper)] rounded-xl shadow-paper px-4 py-3">
            <div className="font-display font-bold text-2xl">{n}</div>
            <div className="text-xs text-[var(--ink)]/55">{label}</div>
          </div>
        ))}
      </div>

      {flash && (
        <p role="status" className="mb-4 rounded-xl bg-[var(--indigo-soft)] border border-[color:var(--line)] px-4 py-3 text-sm">
          {flash}
        </p>
      )}

      <div className="folder-tabs" role="tablist">
        {[
          ["ready", `Ready to issue (${ready.length})`],
          ["earning", `Still earning (${earning.length})`],
          ["history", `History (${awards.length})`],
        ].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={`folder-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="folder-panel p-6 space-y-3">
        {tab === "ready" &&
          (ready.length === 0 ? (
            <p className="text-sm text-[var(--ink)]/50">No one is waiting. Students appear here the moment they reach Gold.</p>
          ) : (
            ready.map((s) => studentRow(s, true))
          ))}

        {tab === "earning" &&
          (earning.length === 0 ? (
            <p className="text-sm text-[var(--ink)]/50">Every student has reached Gold.</p>
          ) : (
            earning.map((s) => studentRow(s, false))
          ))}

        {tab === "history" &&
          (awards.length === 0 ? (
            <p className="text-sm text-[var(--ink)]/50">Nothing issued yet.</p>
          ) : (
            awards.map((a) => (
              <div key={a._id} className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-[var(--lavender)]">
                <span aria-hidden="true" className="text-xl">{a.type === "certificate" ? "🎓" : "🎁"}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {a.type === "certificate" ? `Certificate · ${a.recipientName}` : `${a.reward} · ${nameById[a.student] || "Student"}`}
                  </div>
                  <div className="text-xs text-[var(--ink)]/50">
                    {a.type === "certificate" ? `${a.certId} · ` : ""}
                    {formatDate(a.issuedAt)}
                    {a.type === "certificate" && a.reward ? ` · Reward: ${a.reward}` : ""}
                  </div>
                  {a.note && <p className="text-sm italic text-[var(--ink)]/60 mt-1">&quot;{a.note}&quot;</p>}
                </div>
                {a.type === "certificate" && (
                  <button className="btn btn-light btn-sm border border-[color:var(--line)]" onClick={() => downloadAward(a)} disabled={busyId === a._id}>
                    {busyId === a._id ? "Preparing…" : "Download PDF"}
                  </button>
                )}
              </div>
            ))
          ))}
      </div>

      <div className={`modal-backdrop ${dialog ? "open" : ""}`} onClick={closeDialog}>
        {dialog && (
          <form onSubmit={submit} className="w-[92vw] max-w-md plain-modal p-8 max-h-[86vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-xl mb-1">
              {dialog.mode === "certificate" ? "Issue certificate" : "Send a reward"}
            </h3>
            <p className="text-sm text-[var(--ink)]/55 mb-5">
              {dialog.student.name} · {dialog.student.bountyPoints.toLocaleString("en-US")} points
            </p>

            {dialog.mode === "certificate" && (
              <>
                <label htmlFor="cert-name" className="text-xs font-medium text-[var(--ink)]/60 mb-1 block">Name on the certificate</label>
                <input
                  id="cert-name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  maxLength={80}
                  required
                  className="w-full rounded-xl border border-black/10 p-3 text-sm mb-1"
                />
                <p className="text-xs text-[var(--ink)]/45 mb-4">Check the spelling: this is printed exactly as written.</p>
              </>
            )}

            <label htmlFor="cert-reward" className="text-xs font-medium text-[var(--ink)]/60 mb-1 block">
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
              className="w-full rounded-xl border border-black/10 p-3 text-sm mb-4"
            />
            <datalist id="reward-ideas">
              {REWARD_IDEAS.map((r) => <option key={r} value={r} />)}
            </datalist>

            <label htmlFor="cert-note" className="text-xs font-medium text-[var(--ink)]/60 mb-1 block">Note to the student (optional)</label>
            <textarea
              id="cert-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="w-full rounded-xl border border-black/10 p-3 text-sm mb-1"
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
