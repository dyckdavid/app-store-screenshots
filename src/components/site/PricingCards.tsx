"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { useEntitlements } from "@/lib/billing/use-entitlements";

interface Tier {
  id: string;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  priceKey?: string;
  alt?: { label: string; priceKey: string };
  highlight?: boolean;
}

export const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    blurb: "Everything you need to ship screenshots.",
    features: [
      "All ASC sizes & layouts",
      "Watermark on exports",
      "3 AI actions/day when signed in",
      "Presets saved in your browser",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$9",
    cadence: "/month",
    blurb: "or $79/year — two months free.",
    features: [
      "No watermark",
      "Cloud presets",
      "150 AI actions/month",
      "Early access to new features",
    ],
    priceKey: "asc_pro_monthly",
    alt: { label: "Yearly — $79", priceKey: "asc_pro_yearly" },
    highlight: true,
  },
  {
    id: "lifetime",
    name: "Lifetime",
    price: "$39",
    cadence: "one-time",
    blurb: "Pay once, keep Pro features.",
    features: [
      "No watermark, forever",
      "Cloud presets, forever",
      "50 AI actions/month (fair use)",
    ],
    priceKey: "asc_pro_lifetime",
  },
];

export async function startCheckout(
  priceKey: string,
  router: ReturnType<typeof useRouter>,
): Promise<string | null> {
  track("checkout_started", { priceKey });
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priceKey }),
  });
  if (res.status === 401) {
    router.push(`/sign-in?next=${encodeURIComponent("/pricing")}`);
    return null;
  }
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) return data.error ?? `Checkout failed (${res.status}).`;
  window.location.assign(data.url);
  return null;
}

export default function PricingCards({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { data } = useEntitlements();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(priceKey: string) {
    if (data && !data.signedIn) {
      router.push(`/sign-in?next=${encodeURIComponent("/pricing")}`);
      return;
    }
    setBusy(priceKey);
    setError(null);
    try {
      const err = await startCheckout(priceKey, router);
      if (err) setError(err);
    } catch {
      setError("Checkout is unavailable right now.");
    } finally {
      setBusy(null);
    }
  }

  const currentPlan = data?.plan ?? "free";

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((tier) => {
          const isCurrent = data?.signedIn && currentPlan === tier.id;
          return (
            <div
              key={tier.id}
              className={`flex flex-col rounded-[1.5rem] border p-6 ${
                tier.highlight
                  ? "border-[var(--accent)] bg-white shadow-[0_10px_40px_-20px_rgba(15,118,110,0.6)]"
                  : "border-[var(--line)] bg-[var(--surface)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--ink)]">{tier.name}</h3>
                {tier.highlight ? (
                  <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
                    Most popular
                  </span>
                ) : null}
              </div>
              <p className="mt-3">
                <span className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
                  {tier.price}
                </span>{" "}
                <span className="text-sm text-[var(--muted)]">{tier.cadence}</span>
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">{tier.blurb}</p>
              {!compact ? (
                <ul className="mt-5 flex-1 space-y-2 text-sm text-[var(--ink-soft)]">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span aria-hidden className="text-[var(--accent)]">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex-1" />
              )}
              <div className="mt-6 space-y-2">
                {isCurrent ? (
                  <Link
                    href="/account"
                    className="flex min-h-[44px] items-center justify-center rounded-full border border-[var(--line)] bg-white text-sm font-medium text-[var(--ink)]"
                  >
                    Your current plan
                  </Link>
                ) : tier.priceKey ? (
                  <>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => buy(tier.priceKey!)}
                      className="min-h-[44px] w-full rounded-full bg-[var(--accent)] text-sm font-medium text-white disabled:opacity-50"
                    >
                      {busy === tier.priceKey ? "Redirecting…" : `Get ${tier.name}`}
                    </button>
                    {tier.alt ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => buy(tier.alt!.priceKey)}
                        className="min-h-[44px] w-full rounded-full border border-[var(--line)] bg-white text-sm font-medium text-[var(--ink)] disabled:opacity-50"
                      >
                        {busy === tier.alt.priceKey ? "Redirecting…" : tier.alt.label}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <Link
                    href="/studio"
                    className="flex min-h-[44px] items-center justify-center rounded-full border border-[var(--line)] bg-white text-sm font-medium text-[var(--ink)]"
                  >
                    Start free
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-[#fff2f2] px-4 py-3 text-sm text-[#b91010]">
          {error}
        </p>
      ) : null}
      <p className="mt-4 text-center text-xs text-[var(--muted)]">
        7-day money-back guarantee. Prices in USD, taxes may apply.
      </p>
    </div>
  );
}
