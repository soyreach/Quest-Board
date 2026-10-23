"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Award, BookOpen, Eye, EyeOff, GraduationCap } from "lucide-react";
import { saveAccount } from "@/lib/savedAccounts";
import TargetLogo from "@/components/TargetLogo";

const ROLES = [
  { key: "Student", icon: GraduationCap, blurb: "Take quests, earn points" },
  { key: "Professor", icon: BookOpen, blurb: "Post quests, review work" },
  { key: "Committee", icon: Award, blurb: "Sign certificates" },
];

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  const [mode, setMode] = useState("signup"); // "signup" | "signin"
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState(""); // sign-in: username or email
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("Student");
  const [roleCode, setRoleCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  function switchMode(next) {
    setMode(next);
    setError("");
    setShowPassword(false);
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

  const signingUp = mode === "signup";

  const passwordField = (
    <div>
      <label htmlFor="auth-password" className="auth-label">Password</label>
      <div className="relative">
        <input
          id="auth-password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={signingUp ? "At least 6 characters" : ""}
          required
          minLength={signingUp ? 6 : undefined}
          autoComplete={signingUp ? "new-password" : "current-password"}
          className="field pr-11"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 grid place-content-center rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--lavender)] transition-colors"
        >
          {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen -mt-24 pt-28 pb-16 px-6 flex items-start md:items-center justify-center page-enter">
      <div className="auth-shell w-full max-w-4xl grid md:grid-cols-[1fr_1.05fr]">
        {/* The board side: a pinned member card that fills in as you type */}
        <div className="hero-bg hidden md:flex flex-col justify-between p-10 text-white">
          <div className="relative flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg bg-[var(--paper)] grid place-content-center">
              <TargetLogo className="w-6 h-6" />
            </span>
            <span className="font-display font-bold">Quest Board</span>
          </div>

          <div className="relative py-10">
            <div className="member-card" style={{ rotate: "-2.5deg" }}>
              <div className="pin" />
              <div className="flex items-center justify-between mb-5">
                <span className="text-[0.65rem] font-bold tracking-[0.16em] uppercase text-[var(--ink)]/60">AUPP · Member card</span>
                <span className="badge badge-quiet">{signingUp ? role : "Returning"}</span>
              </div>
              <div className="text-[0.65rem] font-bold tracking-[0.16em] uppercase text-[var(--ink)]/50 mb-1">Name on certificates</div>
              <div className={`font-hand text-2xl leading-tight min-h-[2rem] border-b border-dashed border-[color:var(--line)] pb-1 truncate ${signingUp && fullName ? "" : "text-[var(--ink)]/35"}`}>
                {signingUp ? fullName || "Your name here" : "Welcome back"}
              </div>
              <div className="flex items-end justify-between mt-5">
                <div className="meta truncate">
                  {signingUp ? (username ? `@${username}` : "@username") : identifier || "Pick up where you left off"}
                </div>
                <div className="stamp !static !w-12 !h-12 !text-sm shrink-0">0<small>PTS</small></div>
              </div>
            </div>
          </div>

          <p className="relative font-hand text-lg text-white/80 leading-snug">
            {signingUp
              ? "Every certificate starts as a blank card pinned to the board."
              : "Your quests are right where you pinned them."}
          </p>
        </div>

        {/* The form side */}
        <div className="bg-[var(--paper)] p-7 sm:p-10">
          <div className="seg mb-6" role="group" aria-label="Choose sign up or sign in">
            <button type="button" aria-pressed={signingUp} onClick={() => switchMode("signup")}>Sign up</button>
            <button type="button" aria-pressed={!signingUp} onClick={() => switchMode("signin")}>Sign in</button>
          </div>

          <h1 className="font-display font-bold text-2xl sm:text-3xl leading-tight mb-1">
            {signingUp ? "Pin yourself to the board" : "Welcome back"}
          </h1>
          <p className="meta mb-6">
            {signingUp ? "One account for quests, reviews and certificates." : "Sign in with your username or email."}
          </p>

          {signingUp ? (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <span className="auth-label">I&apos;m joining as</span>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Account type">
                  {ROLES.map(({ key, icon: Icon, blurb }) => (
                    <label key={key} className="role-option">
                      <input
                        type="radio"
                        name="role"
                        value={key}
                        checked={role === key}
                        onChange={() => { setRole(key); setRoleCode(""); }}
                        className="sr-only"
                      />
                      <Icon size={18} aria-hidden="true" />
                      <span className="text-sm font-semibold">{key}</span>
                      <span className="text-[0.7rem] leading-tight text-[var(--muted)] hidden sm:block">{blurb}</span>
                    </label>
                  ))}
                </div>
              </div>

              {role !== "Student" && (
                <div>
                  <label htmlFor="auth-code" className="auth-label">{role} verification code</label>
                  <input
                    id="auth-code"
                    type="password"
                    value={roleCode}
                    onChange={(e) => setRoleCode(e.target.value)}
                    placeholder="Given to you by the school"
                    autoComplete="off"
                    className="field"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-name" className="auth-label">Full name</label>
                <input
                  id="auth-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  className="field"
                />
                <p className="meta mt-1">Printed on your certificates exactly as written.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="auth-username" className="auth-label">Username</label>
                  <input
                    id="auth-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    pattern="[A-Za-z0-9._\-]{3,30}"
                    title="3–30 characters: letters, numbers, dots, dashes or underscores"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="field"
                  />
                </div>
                <div>
                  <label htmlFor="auth-email" className="auth-label">Email</label>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="field"
                  />
                </div>
              </div>

              {passwordField}

              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

              <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                {loading ? "Creating account…" : "Create account"}
              </button>
              <p className="meta text-center">
                Already have an account?{" "}
                <button type="button" className="underline font-semibold text-[var(--ink)]" onClick={() => switchMode("signin")}>Sign in</button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignin} className="space-y-4">
              <div>
                <label htmlFor="auth-identifier" className="auth-label">Username or email</label>
                <input
                  id="auth-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  className="field"
                />
              </div>

              {passwordField}

              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

              <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
              <p className="meta text-center">
                New here?{" "}
                <button type="button" className="underline font-semibold text-[var(--ink)]" onClick={() => switchMode("signup")}>Create an account</button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
