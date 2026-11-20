"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { hardNavigate, notifyAuthChanged } from "@/lib/auth/session-client";
import { authErrorMessage } from "@/lib/auth/errors";

const RESEND_SECONDS = 30;

export default function SignInForm({
  next,
  appleEnabled,
  initialError,
}: {
  next: string;
  appleEnabled: boolean;
  initialError?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState<null | "send" | "verify" | "google" | "apple">(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (stage === "code") codeRef.current?.focus();
  }, [stage]);

  const callbackURL = `/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (cooldown > 0) return;
    setBusy("send");
    setError(null);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim().toLowerCase(),
        type: "sign-in",
      });
      if (res?.error) throw res.error;
      setStage("code");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(authErrorMessage(err, "Could not send the code. Try again."));
    } finally {
      setBusy(null);
    }
  }

  async function verify(code: string) {
    setBusy("verify");
    setError(null);
    try {
      const res = await authClient.signIn.emailOtp({
        email: email.trim().toLowerCase(),
        otp: code.trim(),
      });
      if (res?.error) throw res.error;
      notifyAuthChanged();
      // Hard navigation: server pages and the header re-read the new cookie.
      hardNavigate(next);
    } catch (err) {
      setError(authErrorMessage(err, "That code didn't work. Try again."));
      setBusy(null);
    }
  }

  async function social(provider: "google" | "apple") {
    setBusy(provider);
    setError(null);
    try {
      const res = await authClient.signIn.social({
        provider,
        callbackURL: new URL(callbackURL, window.location.origin).toString(),
        errorCallbackURL: new URL(`/sign-in?error=oauth&next=${encodeURIComponent(next)}`, window.location.origin).toString(),
      });
      if (res?.error) throw res.error;
      // The SDK redirects the browser to the provider.
    } catch (err) {
      setError(authErrorMessage(err, "Sign-in failed. Try again."));
      setBusy(null);
    }
  }

  const input =
    "min-h-[48px] w-full rounded-xl border border-[var(--line)] bg-white px-4 text-[15px] text-[var(--ink)] outline-none focus:border-[var(--accent)]";
  const primary =
    "min-h-[48px] w-full rounded-full bg-[var(--accent)] px-6 text-sm font-medium text-white disabled:opacity-50";
  const secondary =
    "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white px-6 text-sm font-medium text-[var(--ink)] disabled:opacity-50";

  return (
    <div className="space-y-4">
      {stage === "email" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="block text-sm font-medium text-[var(--ink-soft)]">
            Email
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${input} mt-1.5`}
              placeholder="you@example.com"
            />
          </label>
          <button type="submit" disabled={busy !== null || !email.trim()} className={primary}>
            {busy === "send" ? "Sending…" : "Email me a sign-in code"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify(otp);
          }}
          className="space-y-3"
        >
          <p className="text-sm text-[var(--muted)]">
            We sent a 6-digit code to <strong className="text-[var(--ink)]">{email}</strong>. It can take a minute — check spam too.
          </p>
          <label className="block text-sm font-medium text-[var(--ink-soft)]">
            Code
            <input
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={8}
              required
              value={otp}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                setOtp(v);
                // Auto-submit when a full 6-digit code is typed or pasted.
                if (v.length === 6 && busy === null) void verify(v);
              }}
              className={`${input} mt-1.5 text-center font-[family-name:var(--font-jetbrains)] text-lg tracking-[0.4em]`}
              placeholder="••••••"
            />
          </label>
          <button type="submit" disabled={busy !== null || otp.length < 4} className={primary}>
            {busy === "verify" ? "Signing in…" : "Sign in"}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="text-[var(--muted)] underline"
              onClick={() => {
                setStage("email");
                setOtp("");
                setError(null);
              }}
            >
              Use a different email
            </button>
            <button
              type="button"
              disabled={cooldown > 0 || busy !== null}
              onClick={() => void sendCode()}
              className="text-[var(--accent)] underline disabled:no-underline disabled:opacity-50"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
        <span className="h-px flex-1 bg-[var(--line)]" />
        or
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <button type="button" disabled={busy !== null} onClick={() => void social("google")} className={secondary}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12S6.6 21.7 12 21.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
        {busy === "google" ? "Opening Google…" : "Continue with Google"}
      </button>
      {appleEnabled ? (
        <button type="button" disabled={busy !== null} onClick={() => void social("apple")} className={secondary}>
           {busy === "apple" ? "Opening Apple…" : "Continue with Apple"}
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-[#fff2f2] px-4 py-3 text-sm text-[#b91010]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
