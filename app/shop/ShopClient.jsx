"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, Eye, Gift, ImagePlus, Pencil, Plus, Undo2 } from "lucide-react";
import { MAX_SHOP_IMAGE_BYTES, MAX_SHOP_ITEM_COST, MAX_SHOP_ITEM_STOCK } from "@/lib/constants";
import { spendablePoints } from "@/lib/shop";
import { useLingering } from "@/lib/useLingering";

const REWARD_IDEAS = ["Quest Board hoodie", "Notebook", "Pen", "Pencil case", "Campus bookstore voucher"];
const EMPTY_FORM = { name: "", description: "", pointsCost: "", stock: "" };

const STATUS = {
  Pending: { label: "Waiting to collect", className: "badge-warn" },
  Collected: { label: "Collected", className: "badge-ok" },
  Cancelled: { label: "Cancelled, points returned", className: "badge-quiet" },
};

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
const pts = (n) => n.toLocaleString("en-US");

export default function ShopClient({ role, initialItems, initialRedemptions, initialPoints }) {
  const router = useRouter();
  const isStudent = role === "Student";
  const isCommittee = role === "Committee";

  const [items, setItems] = useState(initialItems);
  const [redemptions, setRedemptions] = useState(initialRedemptions);
  const [pointsSpent, setPointsSpent] = useState(initialPoints?.pointsSpent ?? 0);
  const [tab, setTab] = useState(() =>
    isCommittee && initialRedemptions.some((r) => r.status === "Pending") ? "requests" : "rewards"
  );
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [exchangeTarget, setExchanging] = useState(null); // the item a student is about to exchange for
  const [cancelTarget, setCancelling] = useState(null); // the request the committee is about to cancel
  const [rewardTarget, setRewardForm] = useState(null); // { item } while the add/edit dialog is open; item is null when adding
  // These stay on screen while a dialog closes.
  const exchanging = useLingering(exchangeTarget);
  const cancelling = useLingering(cancelTarget);
  const rewardForm = useLingering(rewardTarget);
  const [cardsIntro, setCardsIntro] = useState(true); // cards only pin themselves in once per visit
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState(null); // { file, url } for a newly chosen picture
  const [removePhoto, setRemovePhoto] = useState(false);

  const earned = initialPoints?.bountyPoints ?? 0;
  const balance = spendablePoints({ bountyPoints: earned, pointsSpent });
  const pending = redemptions.filter((r) => r.status === "Pending");
  const handled = redemptions.filter((r) => r.status !== "Pending");
  const pointsExchanged = redemptions.filter((r) => r.status !== "Cancelled").reduce((sum, r) => sum + r.pointsCost, 0);

  function say(message) {
    setFlash(message);
    setTimeout(() => setFlash(""), 6000);
  }

  const replaceItem = (item) => setItems((list) => list.map((i) => (i._id === item._id ? item : i)));

  function closeDialogs() {
    if (busy) return;
    setExchanging(null);
    setCancelling(null);
    setRewardForm(null);
    setError("");
  }

  async function confirmExchange() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shop/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: exchanging._id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      replaceItem(data.item);
      setRedemptions((list) => [data.redemption, ...list]);
      setPointsSpent(data.pointsSpent);
      say(`${data.item.name} is yours. Collect it from the school committee.`);
      setExchanging(null);
      router.refresh(); // the hub and leaderboard shouldn't show a remembered balance
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRequest(redemption, action) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/shop/redemptions/${redemption._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      setRedemptions((list) => list.map((r) => (r._id === redemption._id ? data.redemption : r)));
      if (data.item) replaceItem(data.item);
      say(
        action === "collect"
          ? `${redemption.itemName} marked as handed over to ${redemption.student?.name}.`
          : `Request cancelled. ${redemption.student?.name} got ${pts(redemption.pointsCost)} points back.`
      );
      setCancelling(null);
    } catch (err) {
      if (action === "collect") say(err.message);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function openRewardForm(item) {
    setRewardForm({ item });
    setForm(
      item
        ? { name: item.name, description: item.description, pointsCost: String(item.pointsCost), stock: String(item.stock) }
        : EMPTY_FORM
    );
    setPhoto(null);
    setRemovePhoto(false);
    setError("");
  }

  function pickPhoto(file) {
    if (!file) return;
    if (file.size > MAX_SHOP_IMAGE_BYTES) {
      setError(`The photo is too large (max ${MAX_SHOP_IMAGE_BYTES / (1024 * 1024)}MB).`);
      return;
    }
    setError("");
    setPhoto({ file, url: URL.createObjectURL(file) });
    setRemovePhoto(false);
  }

  async function saveReward(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const editing = rewardForm.item;
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    if (photo) body.append("image", photo.file);
    if (removePhoto) body.append("removeImage", "true");
    try {
      const res = await fetch(editing ? `/api/shop/items/${editing._id}` : "/api/shop/items", {
        method: editing ? "PATCH" : "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      setItems((list) =>
        (editing ? list.map((i) => (i._id === data._id ? data : i)) : [...list, data]).sort(
          (a, b) => a.pointsCost - b.pointsCost || a.name.localeCompare(b.name)
        )
      );
      say(editing ? `${data.name} updated.` : `${data.name} is now in the shop.`);
      setRewardForm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleHidden(item) {
    const body = new FormData();
    body.append("active", String(!item.active));
    try {
      const res = await fetch(`/api/shop/items/${item._id}`, { method: "PATCH", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      replaceItem(data);
      say(data.active ? `${data.name} is back in the shop.` : `${data.name} is hidden from students.`);
    } catch (err) {
      say(err.message);
    }
  }

  function renderCard(item, i) {
    const short = item.pointsCost - balance;
    const soldOut = item.stock === 0;
    return (
      <article
        key={item._id}
        className={`quest-card shop-card p-4 ${item.active ? "" : "shop-card-hidden"}`}
        style={{ transform: `rotate(${((i % 5) - 2) * 0.5}deg)`, "--i": Math.min(i, 8) }}
      >
        <div className="pin" />
        <div className={`stamp ${item.pointsCost >= 100000 ? "stamp-xlong" : item.pointsCost >= 1000 ? "stamp-long" : ""}`}>
          {item.pointsCost}<small>PTS</small>
        </div>
        <div className="shop-photo mb-3">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" />
          ) : (
            <Gift size={40} strokeWidth={1.5} aria-hidden="true" />
          )}
        </div>
        <h3 className="font-display font-semibold text-lg leading-snug mb-1 line-clamp-2 break-words">{item.name}</h3>
        {item.description && (
          <p className="text-[13px] leading-relaxed line-clamp-3 text-[var(--ink)]/80 mb-3 break-words">{item.description}</p>
        )}

        <div className="mt-auto pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-[color:var(--line)]">
          <span className={`text-xs font-semibold ${soldOut || item.stock <= 3 ? "text-[var(--stamp)]" : "text-[var(--muted)]"}`}>
            {soldOut ? "Out of stock" : item.stock <= 3 ? `Only ${item.stock} left` : `${pts(item.stock)} in stock`}
          </span>

          {isStudent && !soldOut && (
            short > 0 ? (
              <span className="badge badge-quiet tabular-nums">{pts(short)} pts short</span>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                aria-label={`Exchange ${item.pointsCost} points for ${item.name}`}
                onClick={() => { setError(""); setExchanging(item); }}
              >
                Exchange
              </button>
            )
          )}

          {isCommittee && (
            <span className="flex items-center gap-1 -mr-1">
              {!item.active && <span className="badge badge-quiet">Hidden</span>}
              <button type="button" className="quiet-btn" aria-label={`Edit ${item.name}`} onClick={() => openRewardForm(item)}>
                <Pencil size={14} aria-hidden="true" /> Edit
              </button>
              <button
                type="button"
                className="quiet-btn"
                aria-label={`${item.active ? "Hide" : "Show"} ${item.name}`}
                onClick={() => toggleHidden(item)}
              >
                {item.active ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                {item.active ? "Hide" : "Show"}
              </button>
            </span>
          )}
        </div>
      </article>
    );
  }

  function renderRequest(r, actions) {
    return (
      <div key={r._id} className="row flex flex-wrap items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-[var(--lavender)] grid place-content-center text-sm font-bold shrink-0" aria-hidden="true">
          {(r.student?.name || "?")[0].toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <div className="font-medium break-words">{r.itemName}</div>
          <div className="meta truncate">
            {r.student?.name} · @{r.student?.username} · {r.student?.email}
          </div>
          <div className="meta tabular-nums">
            {pts(r.pointsCost)} pts · {formatDate(r.createdAt)}
            {r.handledAt && ` · ${r.status === "Collected" ? "handed over" : "cancelled"} ${formatDate(r.handledAt)}`}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => handleRequest(r, "collect")}>
              <Check size={14} aria-hidden="true" /> Mark handed over
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setError(""); setCancelling(r); }}>
              <Undo2 size={14} aria-hidden="true" /> Cancel &amp; refund
            </button>
          </div>
        ) : (
          <span className={`badge ${STATUS[r.status].className}`}>{r.status === "Cancelled" ? "Cancelled, refunded" : "Handed over"}</span>
        )}
      </div>
    );
  }

  const TABS = isStudent
    ? [["rewards", "Rewards", items.length], ["mine", "My exchanges", redemptions.length]]
    : isCommittee
    ? [["rewards", "Rewards", items.length], ["requests", "To hand over", pending.length], ["history", "History", handled.length]]
    : [];

  const STATS = isStudent
    ? [["Points to spend", pts(balance)], ["Earned all time", pts(earned)], ["Spent", pts(pointsSpent)], ["Waiting to collect", pending.length]]
    : isCommittee
    ? [["Rewards in the shop", items.filter((i) => i.active).length], ["To hand over", pending.length], ["Handed over", handled.filter((r) => r.status === "Collected").length], ["Points exchanged", pts(pointsExchanged)]]
    : null;

  const board = (
    <div className={`corkboard ${cardsIntro ? "cards-in" : "tab-fade"} p-6 sm:p-8 md:p-10 min-h-[480px] grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10 content-start`}>
      {items.length === 0 ? (
        <div className="col-span-full flex justify-center py-12">
          <div className="paper-note max-w-sm text-center" style={{ transform: "rotate(-1deg)" }}>
            <div className="pin" />
            <h2 className="font-display font-semibold text-lg mb-1">Nothing on the shelf yet</h2>
            <p className="meta">
              {isCommittee ? "Add the first reward and students can start exchanging their points." : "The school committee hasn't added any rewards yet. Check back soon."}
            </p>
          </div>
        </div>
      ) : (
        items.map(renderCard)
      )}
    </div>
  );

  const shownPhoto = photo?.url || (!removePhoto && rewardForm?.item?.imageUrl);

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-24 page-enter">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="hub-eyebrow">{isCommittee ? "Committee shop desk" : "Spend your bounty"}</div>
          <h1 className="font-display font-bold text-3xl leading-tight">The exchange shop</h1>
          <p className="meta mt-1 max-w-xl">
            {isCommittee
              ? "Add rewards for students to exchange their points for, then hand them over when they come to collect."
              : "Trade your bounty points for rewards from the school committee. Spending never lowers your tier, certificate progress or leaderboard rank."}
          </p>
        </div>
        {isCommittee && (
          <button type="button" className="btn btn-primary" onClick={() => openRewardForm(null)}>
            <Plus size={16} aria-hidden="true" /> Add a reward
          </button>
        )}
      </header>

      {STATS && (
        <div className="stat-strip grid-cols-4 mb-8">
          {STATS.map(([label, value]) => (
            <div key={label}>
              <div className="stat-label">{label}</div>
              <div className="stat-value">{value}</div>
            </div>
          ))}
        </div>
      )}

      {flash && (
        <p role="status" className="mb-4 rounded-xl bg-[var(--indigo-soft)] border border-[color:var(--line)] px-4 py-3 text-sm">
          {flash}
        </p>
      )}

      {TABS.length > 0 && (
        <div className="folder-tabs" role="tablist">
          {TABS.map(([key, label, count]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={`folder-tab inline-flex items-center gap-2 ${tab === key ? "active" : ""}`}
              onClick={() => { setTab(key); setCardsIntro(false); }}
            >
              {label} <span className="count-pill">{count}</span>
            </button>
          ))}
        </div>
      )}

      {tab === "rewards" && board}

      {tab === "mine" && (
        <div className="folder-panel tab-fade">
          {redemptions.length === 0 ? (
            <p className="empty-note">Nothing yet. Rewards you exchange your points for will be listed here.</p>
          ) : (
            <div className="row-list">
              {redemptions.map((r) => (
                <div key={r._id} className="row flex flex-wrap items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-[var(--lavender)] grid place-content-center shrink-0 text-[var(--wood)]" aria-hidden="true">
                    <Gift size={16} />
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="font-medium break-words">{r.itemName}</div>
                    <div className="meta tabular-nums">{pts(r.pointsCost)} pts · {formatDate(r.createdAt)}</div>
                  </div>
                  <span className={`badge ${STATUS[r.status].className}`}>{STATUS[r.status].label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="folder-panel tab-fade">
          {pending.length === 0 ? (
            <p className="empty-note">Nothing to hand over. Requests appear here the moment a student exchanges points.</p>
          ) : (
            <div className="row-list">{pending.map((r) => renderRequest(r, true))}</div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="folder-panel tab-fade">
          {handled.length === 0 ? (
            <p className="empty-note">No handed over or cancelled requests yet.</p>
          ) : (
            <div className="row-list">{handled.map((r) => renderRequest(r, false))}</div>
          )}
        </div>
      )}

      <div className={`modal-backdrop ${exchangeTarget || cancelTarget || rewardTarget ? "open" : ""}`} onClick={closeDialogs}>
        {exchanging && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exchange-title"
            className="w-[92vw] max-w-md plain-modal p-8 max-h-[86vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="exchange-title" className="font-display font-semibold text-xl mb-1 break-words">Exchange for {exchanging.name}?</h3>
            <p className="text-sm text-[var(--ink)]/70 mb-5">You&apos;ll collect it from the school committee.</p>
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="metric">
                <div className="metric-label">You have</div>
                <div className="metric-value">{pts(balance)}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Cost</div>
                <div className="metric-value text-[var(--stamp)]">−{pts(exchanging.pointsCost)}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Left after</div>
                <div className="metric-value">{pts(Math.max(0, balance - exchanging.pointsCost))}</div>
              </div>
            </div>
            {error && <p className="text-xs text-red-600 mb-3" role="alert">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn-light btn-sm border border-[color:var(--line)]" onClick={closeDialogs}>Not now</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={confirmExchange}>
                {busy ? "Exchanging…" : `Spend ${pts(exchanging.pointsCost)} points`}
              </button>
            </div>
          </div>
        )}

        {cancelling && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            className="w-[92vw] max-w-md plain-modal p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="cancel-title" className="font-display font-semibold text-xl mb-1">Cancel this request?</h3>
            <p className="text-sm text-[var(--ink)]/70 mb-5 break-words">
              {cancelling.student?.name} gets {pts(cancelling.pointsCost)} points back and {cancelling.itemName} returns to the shop&apos;s stock. They&apos;ll be notified. This can&apos;t be undone.
            </p>
            {error && <p className="text-xs text-red-600 mb-3" role="alert">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn-light btn-sm border border-[color:var(--line)]" onClick={closeDialogs}>Keep request</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => handleRequest(cancelling, "cancel")}>
                {busy ? "Cancelling…" : "Cancel & refund"}
              </button>
            </div>
          </div>
        )}

        {rewardForm && (
          <form onSubmit={saveReward} className="w-[92vw] max-w-md plain-modal p-8 max-h-[86vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-xl mb-5">{rewardForm.item ? "Edit reward" : "Add a reward"}</h3>

            <label htmlFor="reward-name" className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">Name</label>
            <input
              id="reward-name"
              list="shop-reward-ideas"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={80}
              required
              placeholder="e.g. Quest Board hoodie"
              className="field mb-4"
            />
            <datalist id="shop-reward-ideas">
              {REWARD_IDEAS.map((r) => <option key={r} value={r} />)}
            </datalist>

            <label htmlFor="reward-description" className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">Description (optional)</label>
            <textarea
              id="reward-description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={240}
              className="field mb-4"
            />

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label htmlFor="reward-cost" className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">Cost in points</label>
                <input
                  id="reward-cost"
                  type="number"
                  min={1}
                  max={MAX_SHOP_ITEM_COST}
                  step={1}
                  value={form.pointsCost}
                  onChange={(e) => setForm((f) => ({ ...f, pointsCost: e.target.value }))}
                  required
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="reward-stock" className="text-xs font-medium text-[var(--ink)]/70 mb-1 block">How many are available</label>
                <input
                  id="reward-stock"
                  type="number"
                  min={0}
                  max={MAX_SHOP_ITEM_STOCK}
                  step={1}
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  required
                  className="field"
                />
              </div>
            </div>

            <div className="text-xs font-medium text-[var(--ink)]/70 mb-1">Photo (optional)</div>
            <div className="flex items-center gap-3">
              <div className="shop-photo w-20 shrink-0">
                {shownPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shownPhoto} alt="" />
                ) : (
                  <Gift size={24} strokeWidth={1.5} aria-hidden="true" />
                )}
              </div>
              <label className="quiet-btn cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2">
                <ImagePlus size={14} aria-hidden="true" /> {shownPhoto ? "Change" : "Choose a photo"}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="sr-only"
                  onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }}
                />
              </label>
              {shownPhoto && (
                <button type="button" className="quiet-btn" onClick={() => { setPhoto(null); setRemovePhoto(true); }}>
                  Remove
                </button>
              )}
            </div>

            {error && <p className="text-xs text-red-600 mt-3" role="alert">{error}</p>}

            <div className="flex flex-wrap justify-end gap-2 mt-6">
              <button type="button" className="btn btn-light btn-sm border border-[color:var(--line)]" onClick={closeDialogs}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                {busy ? "Saving…" : rewardForm.item ? "Save changes" : "Add to the shop"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
