/** Human description of the current plan for the account page (pure). */
import type { Plan } from "./plans";
import type { EntitlementRow } from "./entitlement-rules";

function fmt(d: Date | null): string {
  return d ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "—";
}

export function describePlan(
  plan: Plan,
  activeRows: (EntitlementRow & { stripeSubscriptionId?: string | null })[],
): string {
  if (plan === "free") return "Free plan — exports include a small watermark.";
  const pro = activeRows.filter((r) => r.entitlementKey === "asc_pro");
  const sub = pro.find((r) => r.source === "subscription");
  if (sub) {
    if (sub.status === "past_due") return `Payment failed — access continues while we retry (until ${fmt(sub.validUntil)}).`;
    return sub.cancelAtPeriodEnd || sub.status === "canceled"
      ? `Cancels on ${fmt(sub.validUntil)}. No watermark until then.`
      : `Renews on ${fmt(sub.validUntil)}. No watermark.`;
  }
  if (plan === "lifetime") return "Lifetime access — no renewals, no watermark.";
  const admin = pro.find((r) => r.source === "admin");
  if (admin) return admin.validUntil ? `Pro access granted until ${fmt(admin.validUntil)}. No watermark.` : "Pro access granted — no renewals, no watermark.";
  return "No watermark.";
}
