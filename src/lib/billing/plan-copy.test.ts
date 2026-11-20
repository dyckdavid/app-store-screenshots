import { describe, expect, it } from "vitest";
import { describePlan } from "./plan-copy";
import type { EntitlementRow } from "./entitlement-rules";

const row = (p: Partial<EntitlementRow>): EntitlementRow => ({
  entitlementKey: "asc_pro",
  source: "subscription",
  status: "active",
  validUntil: new Date("2026-12-20T00:00:00Z"),
  productKey: "asc_pro",
  ...p,
});

describe("describePlan", () => {
  it("free mentions the watermark", () => {
    expect(describePlan("free", [])).toMatch(/watermark/);
  });
  it("admin-granted Pro never claims a watermark", () => {
    const s = describePlan("pro", [row({ source: "admin", validUntil: null })]);
    expect(s).toBe("Pro access granted — no renewals, no watermark.");
  });
  it("subscriptions show renew / cancel / past-due dates", () => {
    expect(describePlan("pro", [row({})])).toBe("Renews on Dec 20, 2026. No watermark.");
    expect(describePlan("pro", [row({ cancelAtPeriodEnd: true })])).toMatch(/^Cancels on Dec 20, 2026/);
    expect(describePlan("pro", [row({ status: "past_due" })])).toMatch(/Payment failed/);
  });
  it("lifetime", () => {
    expect(describePlan("lifetime", [row({ source: "purchase", validUntil: null })])).toMatch(/Lifetime access/);
  });
});
