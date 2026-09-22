"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut, signIn } from "next-auth/react";
import { getSavedAccounts, removeSavedAccount } from "@/lib/savedAccounts";

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

  useEffect(() => {
    if (switcherOpen) setSavedAccounts(getSavedAccounts());
  }, [switcherOpen]);

  const links = [
    ...BASE_LINKS,
    ...(role === "Student" ? [{ href: "/student/dashboard", label: "Student hub" }] : []),
    ...(role === "Professor" ? [{ href: "/professor/dashboard", label: "Faculty hub" }] : []),
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
    <nav className="fixed top-0 inset-x-0 z-40 backdrop-blur bg-white/85 border-b border-black/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-display font-bold text-lg">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg,var(--indigo),var(--violet-2))" }}
          >
            Q
          </span>
          Quest Board
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--ink)]">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`nav-link ${pathname === l.href ? "active" : ""}`}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3 relative">
          {status === "authenticated" ? (
            <>
              <span className="text-sm text-[var(--ink)]/60 hidden sm:inline">
                {session.user?.name?.split(" ")[0]}
                {session.user?.role ? ` · ${session.user.role}` : ""}
              </span>

              <button className="btn btn-outline btn-sm" onClick={() => setSwitcherOpen((o) => !o)}>
                Switch account
              </button>

              {switcherOpen && (
                <div className="absolute top-12 right-24 w-64 bg-white rounded-2xl shadow-xl border border-black/10 p-2 z-50">
                  {otherAccounts.length === 0 ? (
                    <p className="text-xs text-[var(--ink)]/45 p-3">
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
                          <div className="text-xs text-[var(--ink)]/45">{a.email} · {a.role}</div>
                        </button>
                        <button
                          className="text-[var(--ink)]/30 hover:text-red-500 text-xs px-2"
                          onClick={() => { removeSavedAccount(a.email); setSavedAccounts(getSavedAccounts()); }}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              <button className="btn btn-outline btn-sm" onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </button>
            </>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={() => router.push("/login")}>
              Sign in
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
