"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut, signIn } from "next-auth/react";
import { ChevronLeft, ChevronRight, LogOut, SquareUserRound } from "lucide-react";
import { getSavedAccounts, removeSavedAccount } from "@/lib/savedAccounts";
import { useLingering } from "@/lib/useLingering";
import NotificationBell from "@/components/NotificationBell";
import TargetLogo from "@/components/TargetLogo";

const BASE_LINKS = [
  { href: "/board", label: "Board" },
  { href: "/ai-sidekick", label: "AI Sidekick" },
  { href: "/shop", label: "Shop" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role;

  const [accountOpen, setAccountOpen] = useState(false);
  const [switchView, setSwitchView] = useState(false); // the account menu is showing its account list
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [switching, setSwitching] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // These stay on screen while the menus close.
  const accountShown = useLingering(accountOpen, 120);
  const menuShown = useLingering(menuOpen, 120);
  const navRef = useRef(null);
  const accountRef = useRef(null);
  const accountButtonRef = useRef(null);
  const backFromSwitch = useRef(false); // puts focus back on the row after leaving the account list

  // The phone menu closes after you pick a page, press Escape, or tap outside it.
  useEffect(() => { setMenuOpen(false); setAccountOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    const onClick = (e) => { if (navRef.current && !navRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [menuOpen]);

  // The account menu works the same way, and hands focus back to its button on Escape.
  useEffect(() => {
    if (!accountOpen) return;
    setSavedAccounts(getSavedAccounts());
    const onKey = (e) => {
      if (e.key === "Escape") { setAccountOpen(false); accountButtonRef.current?.focus(); }
    };
    const onClick = (e) => { if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [accountOpen]);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    function update() {
      const y = window.scrollY;
      const delta = y - lastY;

      if (y < 80) {
        setHidden(false);
      } else if (delta > 4) {
        setHidden(true);
      } else if (delta < -4) {
        setHidden(false);
      }

      lastY = y;
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const hubHref = { Student: "/student/dashboard", Professor: "/professor/dashboard", Committee: "/committee/dashboard" }[role];
  const links = [...BASE_LINKS, ...(hubHref ? [{ href: hubHref, label: "My hub" }] : [])];

  const otherAccounts = savedAccounts.filter((a) => a.email !== session?.user?.email);
  // Sessions from before these fields existed only have the username, as `name`.
  const displayName = session?.user?.fullName || session?.user?.name || "";
  const handle = session?.user?.username || session?.user?.name || "";
  const initial = (displayName || "?")[0].toUpperCase();

  async function switchTo(account) {
    setSwitching(true);
    await signIn("credentials", { email: account.email, password: account.password, redirect: false });
    setSwitching(false);
    setAccountOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      className={`fixed top-4 sm:top-6 inset-x-0 z-40 flex justify-center px-4 transition-[opacity,transform] duration-300 ease-[var(--ease-out)] ${
        hidden ? "opacity-0 -translate-y-6 pointer-events-none" : "opacity-100 translate-y-0"
      }`}
    >
      <div className="w-full max-w-5xl bg-[var(--navy)] border border-white/10 rounded-full shadow-[0_20px_50px_-15px_rgba(59,46,35,0.55)] px-3 sm:px-5 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--paper)" }}
          >
            <TargetLogo className="w-[22px] h-[22px]" />
          </span>
          <span className="font-display font-black text-white text-[15px] tracking-tight hidden sm:inline">
            Quest Board
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-5 lg:gap-7 text-sm font-medium text-white/85 whitespace-nowrap">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={`nav-link !text-white ${pathname === l.href ? "active" : "opacity-85 hover:opacity-100"}`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 relative shrink-0">
          <button
            type="button"
            className="md:hidden w-10 h-10 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 transition-colors"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => { setMenuOpen((o) => !o); setAccountOpen(false); }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
          {status === "authenticated" ? (
            <>
              {role && <NotificationBell closeSignal={accountOpen} onOpen={() => setAccountOpen(false)} />}

              <div ref={accountRef} className="contents">
                <button
                  ref={accountButtonRef}
                  type="button"
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold bg-[var(--paper)] text-[var(--ink)] transition-transform hover:scale-105 active:scale-95"
                  aria-label="Account menu"
                  aria-haspopup="true"
                  aria-expanded={accountOpen}
                  onClick={() => {
                    setAccountOpen((o) => !o);
                    setSwitchView(false);
                    backFromSwitch.current = false;
                    setMenuOpen(false);
                  }}
                >
                  <span aria-hidden="true">{initial}</span>
                </button>

                {accountShown && (
                  <div
                    data-closing={accountOpen ? undefined : ""}
                    className="pop account-menu absolute top-14 right-0 w-80 max-w-[calc(100vw-2rem)] bg-[var(--paper)] text-[var(--ink)] rounded-xl shadow-xl border border-[color:var(--line)] z-50 overflow-hidden">
                    {switchView ? (
                      <div key="switch" className="view-forward">
                        <button
                          type="button"
                          autoFocus
                          className="account-row border-b border-[color:var(--line)]"
                          onClick={() => { backFromSwitch.current = true; setSwitchView(false); }}
                        >
                          <ChevronLeft size={20} aria-hidden="true" /> Switch account
                        </button>
                        {otherAccounts.length === 0 ? (
                          <p className="meta px-4 py-4">
                            No other accounts remembered on this browser yet. Sign in with another account to add one here.
                          </p>
                        ) : (
                          <div className="p-2 max-h-64 overflow-y-auto">
                            {otherAccounts.map((a) => (
                              <div key={a.email} className="flex items-center gap-1">
                                <button
                                  type="button"
                                  className="flex-1 min-w-0 flex items-center gap-3 text-left px-2 py-2 rounded-lg text-sm hover:bg-[var(--lavender)] transition"
                                  disabled={switching}
                                  onClick={() => switchTo(a)}
                                >
                                  <span className="account-avatar w-9 h-9 text-sm" aria-hidden="true">
                                    {(a.username || a.email || "?")[0].toUpperCase()}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block font-medium truncate">{a.username || a.email}</span>
                                    <span className="block meta truncate">{a.email} · {a.role}</span>
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Forget ${a.username || a.email}`}
                                  className="thread-delete !opacity-100"
                                  onClick={() => { removeSavedAccount(a.email); setSavedAccounts(getSavedAccounts()); }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div key="main" className={backFromSwitch.current ? "view-back" : undefined}>
                        <div className="flex items-start gap-3 px-4 py-4 border-b border-[color:var(--line)]">
                          <span className="account-avatar w-11 h-11 text-base" aria-hidden="true">{initial}</span>
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{displayName}</div>
                            <div className="text-sm text-[var(--ink)]/70 truncate">@{handle}</div>
                            {hubHref && (
                              <Link href={hubHref} className="file-link mt-1.5" onClick={() => setAccountOpen(false)}>
                                View your hub
                              </Link>
                            )}
                          </div>
                        </div>

                        <div className="py-2">
                          <button
                            type="button"
                            autoFocus={backFromSwitch.current}
                            className="account-row"
                            onClick={() => setSwitchView(true)}
                          >
                            <SquareUserRound size={20} aria-hidden="true" />
                            <span className="flex-1">Switch account</span>
                            <ChevronRight size={18} aria-hidden="true" />
                          </button>
                          <button type="button" className="account-row" onClick={() => signOut({ callbackUrl: "/" })}>
                            <LogOut size={20} aria-hidden="true" /> Sign out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <button className="btn btn-light btn-sm" onClick={() => router.push("/login")}>
              Sign in
            </button>
          )}
        </div>
      </div>

      {menuShown && (
        <div
          id="mobile-menu"
          data-closing={menuOpen ? undefined : ""}
          className="pop mobile-menu md:hidden absolute left-4 right-4 top-[4.25rem] bg-[var(--paper)] text-[var(--ink)] rounded-xl shadow-xl border border-[color:var(--line)] p-2"
        >
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
