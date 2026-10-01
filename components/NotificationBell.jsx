"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const POLL_MS = 30000;

const ICONS = {
  new_quest: "📌",
  quest_updated: "🔄",
  deadline_soon: "⏰",
  revision_requested: "✏️",
  submission_approved: "✅",
  tier_reached: "🏅",
  benchmark_reached: "🏆",
  submission_received: "📥",
};

function timeAgo(dateStr) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// `closeSignal` lets the nav close this panel when the account switcher opens
// (and `onOpen` lets this panel close the switcher), so the two never overlap.
export default function NotificationBell({ closeSignal, onOpen }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const role = session?.user?.role;

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [ringing, setRinging] = useState(false);

  const wrapRef = useRef(null);
  const unreadRef = useRef(0);
  const seenFirstLoad = useRef(false);

  useEffect(() => {
    unreadRef.current = unread;
  }, [unread]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return; // signed out or a hiccup — keep what we have
      const data = await res.json();
      const next = data.unreadCount || 0;
      // Ring the bell when something new arrives while the page is open,
      // but not for the backlog that's already waiting on first load.
      if (seenFirstLoad.current && next > unreadRef.current) setRinging(true);
      seenFirstLoad.current = true;
      setItems(data.notifications || []);
      setUnread(next);
      setLoaded(true);
    } catch {
      // Network blip: try again on the next poll.
    }
  }, []);

  // Load on sign-in / account switch, then poll and refresh on tab focus.
  useEffect(() => {
    setItems([]);
    setUnread(0);
    setLoaded(false);
    setOpen(false);
    seenFirstLoad.current = false;
    if (status !== "authenticated" || !userId) return;

    refresh();
    const timer = setInterval(refresh, POLL_MS);
    function onVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, userId, refresh]);

  useEffect(() => {
    if (!ringing) return;
    const t = setTimeout(() => setRinging(false), 1200);
    return () => clearTimeout(t);
  }, [ringing]);

  useEffect(() => {
    if (closeSignal) setOpen(false);
  }, [closeSignal]);

  useEffect(() => {
    if (!open) return;
    function onClickAway(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      onOpen?.();
      refresh();
    }
  }

  async function markRead(ids) {
    const newlyRead = items.filter((n) => ids.includes(n._id) && !n.read).length;
    if (!newlyRead) return;
    setItems((list) => list.map((n) => (ids.includes(n._id) ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - newlyRead));
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) refresh();
    } catch {
      refresh();
    }
  }

  async function markAllRead() {
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) refresh();
    } catch {
      refresh();
    }
  }

  async function dismiss(n) {
    setItems((list) => list.filter((x) => x._id !== n._id));
    if (!n.read) setUnread((u) => Math.max(0, u - 1));
    try {
      const res = await fetch(`/api/notifications?id=${n._id}`, { method: "DELETE" });
      if (!res.ok) refresh();
    } catch {
      refresh();
    }
  }

  async function clearAll() {
    setItems([]);
    setUnread(0);
    try {
      const res = await fetch("/api/notifications?all=true", { method: "DELETE" });
      if (!res.ok) refresh();
    } catch {
      refresh();
    }
  }

  function openItem(n) {
    markRead([n._id]);
    setOpen(false);
    if (!n.link) return;
    // The dashboards and board load their data once on page load, so opening
    // the page you're already on needs a real reload to show what's new.
    if (n.link === pathname) window.location.reload();
    else router.push(n.link);
  }

  if (status !== "authenticated" || !userId) return null;

  return (
    <div ref={wrapRef} className="contents">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`relative w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--indigo)] ${
          ringing ? "bell-ring" : ""
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-[18px] h-[18px]"
          aria-hidden="true"
        >
          <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-black flex items-center justify-center"
            style={{ background: "var(--indigo)" }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute top-14 right-[-0.5rem] sm:right-0 w-[min(24rem,calc(100vw-2rem))] bg-white text-[var(--ink)] rounded-2xl shadow-xl border border-black/10 z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
            <h3 className="font-display font-semibold text-sm">Notifications</h3>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              className="text-xs underline text-[var(--ink)]/55 hover:text-[var(--ink)] disabled:no-underline disabled:opacity-40 disabled:cursor-default"
            >
              Mark all as read
            </button>
          </div>

          {!loaded ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--ink)]/45">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--ink)]/50">
              You&apos;re all caught up.{" "}
              {role === "Professor"
                ? "New submissions to review will show up here."
                : "New quests and review results will show up here."}
            </div>
          ) : (
            <ul className="max-h-[min(26rem,70vh)] overflow-y-auto">
              {items.map((n) => (
                <li
                  key={n._id}
                  className={`group flex gap-2 px-4 py-3 border-b border-black/5 last:border-b-0 ${
                    n.read ? "" : "bg-[var(--indigo-soft)]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className="flex flex-1 gap-3 text-left min-w-0"
                  >
                    <span aria-hidden="true" className="text-lg leading-none mt-0.5">
                      {ICONS[n.type] || "🔔"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`text-sm ${n.read ? "font-medium" : "font-semibold"}`}>{n.title}</span>
                        {!n.read && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: "var(--indigo)" }}
                            aria-label="Unread"
                          />
                        )}
                      </span>
                      <span className="block text-xs text-[var(--ink)]/65 mt-0.5 break-words">{n.message}</span>
                      <span className="block text-[11px] text-[var(--ink)]/40 mt-1">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss(n)}
                    aria-label="Dismiss notification"
                    className="self-start text-xs px-1 text-[var(--ink)]/30 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {items.length > 0 && (
            <div className="px-4 py-2 border-t border-black/5 text-right">
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-[var(--ink)]/50 hover:text-red-500"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
