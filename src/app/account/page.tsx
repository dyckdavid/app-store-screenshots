import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/auth/SignOutButton";
import { CheckoutSuccessBanner, ManageBillingButton } from "@/components/account/AccountActions";
import NotConfigured from "@/components/site/NotConfigured";
import { isAuthConfigured } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/server";
import { isDbConfigured } from "@/db/client";
import { findProduct } from "@/lib/billing/catalog";
import { getUserPlan } from "@/lib/billing/entitlements";
import { isRowActive } from "@/lib/billing/entitlement-rules";
import { getQuotaSnapshot } from "@/lib/billing/quota";
import * as repo from "@/lib/billing/repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false },
};

const PLAN_LABEL = { free: "Free", pro: "Pro", lifetime: "Lifetime" } as const;

function fmtDate(d: Date | null | undefined) {
  return d ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

function fmtMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  if (!isAuthConfigured()) {
    return (
      <NotConfigured
        title="Accounts aren't set up yet"
        detail="Set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET to enable accounts."
      />
    );
  }
  const user = await getSessionUser();
  if (!user) redirect("/sign-in?next=/account");
  const { checkout } = await searchParams;

  if (!isDbConfigured()) {
    return (
      <NotConfigured
        title="Billing isn't set up yet"
        detail="You're signed in, but this deployment has no DATABASE_URL, so plans and usage can't be loaded."
      />
    );
  }

  const [{ plan, pastDue }, details, purchases, quota, customerId] = await Promise.all([
    getUserPlan(user.id),
    repo.listEntitlementDetails(user.id),
    repo.listPurchases(user.id),
    getQuotaSnapshot(user.id),
    repo.getStripeCustomerId(user.id),
  ]);

  const sub = details.find((d) => d.source === "subscription" && isRowActive(d));
  const usagePct = quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 100;
  const card = "rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Account</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Signed in as <span className="font-medium text-[var(--ink)]">{user.email ?? user.name ?? "you"}</span>
          </p>
        </div>
        <SignOutButton />
      </div>

      {checkout === "success" ? <CheckoutSuccessBanner initiallyPaid={plan !== "free"} /> : null}

      {pastDue ? (
        <div role="alert" className="rounded-xl border border-[#f3b4b4] bg-[#fff2f2] px-4 py-3 text-sm text-[#8a1010]">
          Your last payment failed. You still have access while Stripe retries —{" "}
          update your card under <strong>Manage billing</strong> to avoid losing Pro.
        </div>
      ) : null}

      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Plan</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">{PLAN_LABEL[plan]}</p>
            {sub ? (
              <p className="mt-1 text-sm text-[var(--muted)]">
                {sub.cancelAtPeriodEnd || sub.status === "canceled"
                  ? `Cancels on ${fmtDate(sub.validUntil)}`
                  : `Renews on ${fmtDate(sub.validUntil)}`}
              </p>
            ) : plan === "lifetime" ? (
              <p className="mt-1 text-sm text-[var(--muted)]">Lifetime access — no renewals.</p>
            ) : (
              <p className="mt-1 text-sm text-[var(--muted)]">Exports include a watermark.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {plan === "free" ? (
              <Link
                href="/pricing"
                className="inline-flex min-h-[44px] items-center rounded-full bg-[var(--accent)] px-5 text-sm font-medium text-white"
              >
                Upgrade
              </Link>
            ) : null}
            {customerId ? <ManageBillingButton /> : null}
          </div>
        </div>
      </section>

      <section className={card}>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          AI actions this {quota.period}
        </p>
        <p className="mt-1 text-lg text-[var(--ink)]">
          {quota.used} / {quota.limit}
          {quota.credits > 0 ? (
            <span className="text-sm text-[var(--muted)]"> · {quota.credits} bonus credits</span>
          ) : null}
        </p>
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={quota.limit}
          aria-valuenow={quota.used}
          className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"
        >
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${usagePct}%` }} />
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">Resets {fmtDate(new Date(quota.resetsAt))} (UTC).</p>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Purchases</p>
          <Link href="/account/library" className="text-sm text-[var(--accent)] underline">
            Your library
          </Link>
        </div>
        {purchases.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No one-time purchases yet. Subscription invoices live in Manage billing.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--line)] text-sm">
            {purchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-[var(--ink)]">{findProduct(p.productKey)?.name ?? p.productKey}</span>
                <span className="text-[var(--muted)]">
                  {fmtMoney(p.amountTotal, p.currency)} · {fmtDate(p.createdAt)}
                  {p.status === "refunded" ? " · refunded" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Security</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Lost a device or signed in somewhere public? Sign out of every browser and device at once.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <SignOutButton />
          <SignOutButton everywhere />
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          To delete your account and data, contact <Link href="/support" className="underline">support</Link>.
        </p>
      </section>
    </main>
  );
}
