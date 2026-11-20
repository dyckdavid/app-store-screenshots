"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

function message(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

export default function SignInForm({
  next,
  appleEnabled,
}: {
  next: string;
  appleEnabled: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackURL = `/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: "sign-in",
      });
      if (res?.error) throw res.error;
      setStage("code");
    } catch (err) {
      setError(message(err, "Could not send the code. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp: otp.trim(),
      });
      if (res?.error) throw res.error;
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(message(err, "That code didn't work. Check it and try again."));
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "apple") {
    setBusy(true);
    setError(null);
    try {
      const res = await authClient.signIn.social({
        provider,
        callbackURL: new URL(callbackURL, window.location.origin).toString(),
      });
      if (res?.error) throw res.error;
    } catch (err) {
      setError(message(err, "Sign-in failed. Try again."));
      setBusy(false);
    }
  }

  const input =
    "min-h-[48px] w-full rounded-xl border border-[var(--line)] bg-white px-4 text-[15px] text-[var(--ink)] outline-none focus:border-[var(--accent)]";
  const primary =
    "min-h-[48px] w-full rounded-full bg-[var(--accent)] px-6 text-sm font-medium text-white disabled:opacity-50";
  const secondary =
    "min-h-[48px] w-full rounded-full border border-[var(--line)] bg-white px-6 text-sm font-medium text-[var(--ink)] disabled:opacity-50";

  return (
    <div className="space-y-4">
      {stage === "email" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="block text-sm font-medium text-[var(--ink-soft)]">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${input} mt-1.5`}
              placeholder="you@example.com"
            />
          </label>
          <button type="submit" disabled={busy || !email} className={primary}>
            {busy ? "Sending…" : "Email me a sign-in code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            We sent a code to <strong className="text-[var(--ink)]">{email}</strong>.
          </p>
          <label className="block text-sm font-medium text-[var(--ink-soft)]">
            Code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className={`${input} mt-1.5 tracking-[0.3em]`}
              placeholder="123456"
            />
          </label>
          <button type="submit" disabled={busy || !otp} className={primary}>
            {busy ? "Verifying…" : "Sign in"}
          </button>
          <button
            type="button"
            className="w-full text-sm text-[var(--muted)] underline"
            onClick={() => {
              setStage("email");
              setOtp("");
            }}
          >
            Use a different email
          </button>
        </form>
      )}

      <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
        <span className="h-px flex-1 bg-[var(--line)]" />
        or
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => social("google")}
        className={secondary}
      >
        Continue with Google
      </button>
      {appleEnabled ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => social("apple")}
          className={secondary}
        >
          Continue with Apple
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
