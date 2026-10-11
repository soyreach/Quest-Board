"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { saveAccount } from "@/lib/savedAccounts";
import TargetLogo from "@/components/TargetLogo";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  const [mode, setMode] = useState("signup"); // "signup" | "signin"
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState(""); // sign-in: username or email
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Student");
  const [roleCode, setRoleCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (status === "authenticated") {
    router.replace("/");
  }

  async function goToDashboard(chosenRole) {
    router.push(
      chosenRole === "Professor"
        ? "/professor/dashboard"
        : chosenRole === "Committee"
        ? "/committee/dashboard"
        : "/student/dashboard"
    );
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, username, email, password, role, roleCode }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoading(false);
      setError(data.error || "Could not create that account.");
      return;
    }

    const result = await signIn("credentials", { identifier: username, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Account created, but sign-in failed — try signing in manually.");
      setMode("signin");
      return;
    }
    saveAccount({ username, email, password, role });
    goToDashboard(role);
  }

  async function handleSignin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", { identifier, password, redirect: false });

    if (result?.error) {
      setLoading(false);
      setError("Incorrect username, email or password.");
      return;
    }

    const me = await fetch("/api/user/me").then((r) => r.json()).catch(() => null);
    saveAccount({ username: me?.username || me?.name || identifier, email: me?.email || identifier, password, role: me?.role });
    setLoading(false);

    // We don't know the role from here without re-reading the session, so
    // just land on home — the nav and dashboards will route correctly from
    // the session once it's loaded.
    router.push("/");
  }

  return (
    <div className="min-h-screen -mt-24 flex items-center justify-center px-6 py-16 page-enter">
      <div className="bg-[var(--paper)] text-[var(--ink)] rounded-[14px] p-9 w-full max-w-sm shadow-paper">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center mb-6 border border-[color:var(--line)]"
          style={{ background: "var(--paper)" }}
        >
          <TargetLogo className="w-7 h-7" />
        </div>

        <div className="flex gap-6 mb-6 border-b border-black/10">
          <button
            className={`pb-3 text-sm font-semibold ${mode === "signup" ? "text-[var(--indigo)] border-b-2 border-[var(--indigo)]" : "text-[var(--ink)]/45"}`}
            onClick={() => { setMode("signup"); setError(""); }}
          >
            Sign up
          </button>
          <button
            className={`pb-3 text-sm font-semibold ${mode === "signin" ? "text-[var(--indigo)] border-b-2 border-[var(--indigo)]" : "text-[var(--ink)]/45"}`}
            onClick={() => { setMode("signin"); setError(""); }}
          >
            Sign in
          </button>
        </div>

        {mode === "signup" ? (
          <form onSubmit={handleSignup} className="space-y-3">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name (shown on certificates)"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              className="w-full rounded-xl border border-black/10 p-3 text-sm"
            />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username (you can sign in with it)"
              required
              pattern="[A-Za-z0-9._\-]{3,30}"
              title="3–30 characters: letters, numbers, dots, dashes or underscores"
              autoComplete="username"
              className="w-full rounded-xl border border-black/10 p-3 text-sm"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full rounded-xl border border-black/10 p-3 text-sm"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (6+ characters)"
              required
              minLength={6}
              className="w-full rounded-xl border border-black/10 p-3 text-sm"
            />

            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  checked={role === "Student"}
                  onChange={() => { setRole("Student"); setRoleCode(""); }}
                />
                Student
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  checked={role === "Professor"}
                  onChange={() => { setRole("Professor"); setRoleCode(""); }}
                />
                Professor
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  checked={role === "Committee"}
                  onChange={() => { setRole("Committee"); setRoleCode(""); }}
                />
                Committee
              </label>
            </div>

            {role !== "Student" && (
              <input
                type="password"
                value={roleCode}
                onChange={(e) => setRoleCode(e.target.value)}
                placeholder={`${role} verification code`}
                className="w-full rounded-xl border border-black/10 p-3 text-sm"
              />
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignin} className="space-y-3">
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Username or email"
              autoComplete="username"
              required
              className="w-full rounded-xl border border-black/10 p-3 text-sm"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full rounded-xl border border-black/10 p-3 text-sm"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
