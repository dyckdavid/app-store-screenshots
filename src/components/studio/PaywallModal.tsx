"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";

export type PaywallReason = "watermark" | "ai_quota" | "ai_signin" | "cloud_presets";

const COPY: Record<PaywallReason, { title: string; body: string }> = {
  watermark: {
    title: "Remove the watermark",
    body: "Free exports carry a small “Made with ASC Studio” badge. Pro and Lifetime exports are clean.",
  },
  ai_quota: {
    title: "You're out of AI actions",
    body: "Free accounts get 3 AI actions a day. Pro includes 150 a month; Lifetime includes 50.",
  },
  ai_signin: {
    title: "Sign in to use AI",
    body: "AI copy, review, and layout suggestions need a free account (3 actions/day).",
  },
  cloud_presets: {
    title: "Sync presets to the cloud",
    body: "Pro and Lifetime keep your presets in your account so they follow you to any browser.",
  },
};

const EVENT = "asc:paywall";

/** Open the paywall from anywhere (e.g. the AI client on 401/402). */
export function openPaywall(reason: PaywallReason) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PaywallReason>(EVENT, { detail: reason }));
}

export default function PaywallModal() {
  const [reason, setReason] = useState<PaywallReason | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const r = (e as CustomEvent<PaywallReason>).detail;
      setReason(r);
      track("paywall_view", { reason: r });
    };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!reason) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setReason(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reason]);

  if (!reason) return null;
  const copy = COPY[reason];
  const signin = reason === "ai_signin";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={() => setReason(null)}
    >
      <div
        className="w-full max-w-md rounded-[1.5rem] bg-[var(--surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="paywall-title" className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          {copy.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{copy.body}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={signin ? "/sign-in?next=/studio" : "/pricing"}
            className="flex min-h-[48px] items-center justify-center rounded-full bg-[var(--accent)] text-sm font-medium text-white"
          >
            {signin ? "Sign in — it's free" : "See Pro plans"}
          </Link>
          <button
            type="button"
            onClick={() => setReason(null)}
            className="min-h-[44px] rounded-full text-sm text-[var(--muted)]"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
