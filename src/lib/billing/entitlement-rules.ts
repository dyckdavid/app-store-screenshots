/**
 * Pure entitlement → plan resolution (no DB). Unit-tested in isolation.
 */
import type { Plan } from "./plans";
import { ENTITLEMENT_PRO } from "./catalog";

export type EntitlementStatus = "active" | "past_due" | "canceled" | "revoked";
export type EntitlementSourceKind = "subscription" | "purchase" | "admin";

export interface EntitlementRow {
  entitlementKey: string;
  source: EntitlementSourceKind;
  status: EntitlementStatus;
  validUntil: Date | null;
  productKey: string | null;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Whether a row currently grants access.
 *  - active / past_due (grace): valid if no end date or end date in future
 *  - canceled: still valid until `validUntil` (cancel-at-period-end), never if null
 *  - revoked: never (refunds / chargebacks)
 */
export function isRowActive(row: EntitlementRow, now = new Date()): boolean {
  if (row.status === "revoked") return false;
  if (row.status === "canceled") {
    return row.validUntil !== null && row.validUntil.getTime() > now.getTime();
  }
  return row.validUntil === null || row.validUntil.getTime() > now.getTime();
}

export function activeKeys(rows: EntitlementRow[], now = new Date()): Set<string> {
  return new Set(rows.filter((r) => isRowActive(r, now)).map((r) => r.entitlementKey));
}

/**
 * Plan resolution. A live subscription (or admin grant) wins over lifetime
 * because Pro carries the larger AI allowance.
 */
export function resolvePlan(rows: EntitlementRow[], now = new Date()): Plan {
  const pro = rows.filter(
    (r) => r.entitlementKey === ENTITLEMENT_PRO && isRowActive(r, now),
  );
  if (pro.length === 0) return "free";
  if (pro.some((r) => r.source === "subscription" || r.source === "admin")) {
    return "pro";
  }
  return "lifetime";
}

export function isPastDue(rows: EntitlementRow[], now = new Date()): boolean {
  return rows.some(
    (r) =>
      r.entitlementKey === ENTITLEMENT_PRO &&
      r.status === "past_due" &&
      isRowActive(r, now),
  );
}

/** Map a Stripe subscription status to our entitlement status. */
export function statusFromStripeSubscription(stripeStatus: string): EntitlementStatus {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    default:
      // incomplete / paused: no access yet
      return "canceled";
  }
}

/**
 * Would buying `productKind` be redundant for someone holding these rows?
 * Prevents double subscriptions / paying for Lifetime twice.
 * Returns a reason code, or null when the purchase makes sense.
 */
export function redundantPurchase(
  rows: EntitlementRow[],
  productKind: "subscription" | "lifetime" | "credits" | "digital",
  grants: string,
  now = new Date(),
): "already_subscribed" | "already_lifetime" | "already_owned" | null {
  const active = rows.filter((r) => r.entitlementKey === grants && isRowActive(r, now));
  if (productKind === "credits") return null;
  if (productKind === "digital") return active.length ? "already_owned" : null;
  const hasLifetime = active.some((r) => r.source === "purchase" && r.validUntil === null);
  if (hasLifetime) return "already_lifetime";
  // A live (not cancelling) subscription: switch plans in the portal instead.
  const liveSub = active.some(
    (r) => r.source === "subscription" && r.status !== "canceled" && !r.cancelAtPeriodEnd,
  );
  if (productKind === "subscription" && liveSub) return "already_subscribed";
  return null;
}
