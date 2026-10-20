"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut, signIn } from "next-auth/react";
import { getSavedAccounts, removeSavedAccount } from "@/lib/savedAccounts";
import NotificationBell from "@/components/NotificationBell";
import TargetLogo from "@/components/TargetLogo";

const BASE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/board", label: "Board" },
  { href: "/ai-sidekick", label: "AI Sidekick" },
];

export default function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role;

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [switching, setSwitching] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef(null);

  // The phone menu closes after you pick a page, press Escape, or tap outside it.
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    const onClick = (e) => { if (navRef.current && !navRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [menuOpen]);

  useEffect(() => {
    if (switcherOpen) setSavedAccounts(getSavedAccounts());
  }, [switcherOpen]);

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

  const links = [
    ...BASE_LINKS,
    ...(role === "Student" ? [{ href: "/student/dashboard", label: "Student hub" }] : []),
    ...(role === "Professor" ? [{ href: "/professor/dashboard", label: "Faculty hub" }] : []),
    ...(role === "Committee" ? [{ href: "/committee/dashboard", label: "Committee hub" }] : []),
  ];

  const otherAccounts = savedAccounts.filter((a) => a.email !== session?.user?.email);

  async function switchTo(account) {
    setSwitching(true);
    await signIn("credentials", { email: account.email, password: account.password, redirect: false });
    setSwitching(false);
    setSwitcherOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      className={`fixed top-4 sm:top-6 inset-x-0 z-40 flex justify-center px-4 transition-all duration-500 ease-out ${
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

        <div className="hidden md:flex items-center gap-7 text-sm font-medium text-white/85">
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
            onClick={() => { setMenuOpen((o) => !o); setSwitcherOpen(false); }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
          {status === "authenticated" ? (
            <>
              <span className="text-xs text-white/90 hidden lg:inline mr-1">
                {session.user?.name?.split(" ")[0]}
                {session.user?.role ? ` · ${session.user.role}` : ""}
              </span>

              {role && <NotificationBell closeSignal={switcherOpen} onOpen={() => setSwitcherOpen(false)} />}

              <button className="btn btn-light btn-sm" onClick={() => setSwitcherOpen((o) => !o)}>
                Switch
              </button>

              {switcherOpen && (
                <div className="absolute top-14 right-16 w-64 bg-[var(--paper)] rounded-xl shadow-xl border border-black/10 p-2 z-50">
                  {otherAccounts.length === 0 ? (
                    <p className="text-xs text-[var(--ink)]/70 p-3">
                      No other accounts remembered on this browser yet. Sign up or sign in with another account to add one here.
                    </p>
                  ) : (
                    otherAccounts.map((a) => (
                      <div key={a.email} className="flex items-center gap-1">
                        <button
                          className="flex-1 text-left px-3 py-2 rounded-xl text-sm hover:bg-[var(--lavender)] transition"
                          disabled={switching}
                          onClick={() => switchTo(a)}
                        >
                          <div className="font-medium">{a.username || a.email}</div>
                          <div className="text-xs text-[var(--ink)]/70">{a.email} · {a.role}</div>
                        </button>
                        <button
                          className="text-[var(--ink)]/70 hover:text-red-500 text-xs px-2"
                          onClick={() => { removeSavedAccount(a.email); setSavedAccounts(getSavedAccounts()); }}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </button>
            </>
          ) : (
            <button className="btn btn-light btn-sm" onClick={() => router.push("/login")}>
              Sign in
            </button>
          )}
        </div>
      </div>

      {menuOpen && (
        <div
          id="mobile-menu"
          className="mobile-menu md:hidden absolute left-4 right-4 top-[4.25rem] bg-[var(--paper)] text-[var(--ink)] rounded-xl shadow-xl border border-[color:var(--line)] p-2"
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
