"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

export function ManageBillingButton({ disabled }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/billing/portal", { method: "POST" });
            const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
            if (!res.ok || !data.url) throw new Error(data.error || "Portal unavailable");
            window.location.assign(data.url);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Portal unavailable");
            setBusy(false);
          }
        }}
        className="min-h-[44px] rounded-full bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-40"
      >
        {busy ? "Opening…" : "Manage billing"}
      </button>
      {error ? <p className="mt-2 text-xs text-[#b91010]">{error}</p> : null}
    </div>
  );
}

/**
 * Shown on /account?checkout=success. The redirect itself grants NOTHING —
 * entitlements only change from verified webhooks — so we poll briefly.
 */
export function CheckoutSuccessBanner({ initiallyPaid }: { initiallyPaid: boolean }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    track("checkout_success", {});
  }, []);

  useEffect(() => {
    if (initiallyPaid || tries >= 8) return;
    const t = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, 2500);
    return () => clearTimeout(t);
  }, [initiallyPaid, tries, router]);

  return (
    <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--ink)]">
      {initiallyPaid
        ? "Thanks! Your purchase is active."
        : "Thanks! We're confirming your payment with Stripe — this page updates automatically."}
    </div>
  );
}
