import { describe, expect, it } from "vitest";
import {
  isPastDue,
  isRowActive,
  resolvePlan,
  statusFromStripeSubscription,
  type EntitlementRow,
} from "./entitlement-rules";
import { getPlanLimits } from "./plans";

const now = new Date("2026-11-18T12:00:00Z");
const future = new Date("2026-12-18T12:00:00Z");
const past = new Date("2026-10-18T12:00:00Z");

function row(p: Partial<EntitlementRow>): EntitlementRow {
  return {
    entitlementKey: "asc_pro",
    source: "subscription",
    status: "active",
    validUntil: future,
    productKey: "asc_pro",
    ...p,
  };
}

describe("isRowActive", () => {
  it.each<[string, Partial<EntitlementRow>, boolean]>([
    ["active, future end", {}, true],
    ["active, no end (lifetime)", { validUntil: null }, true],
    ["active, expired", { validUntil: past }, false],
    ["past_due grace", { status: "past_due" }, true],
    ["canceled at period end, still in period", { status: "canceled" }, true],
    ["canceled, period over", { status: "canceled", validUntil: past }, false],
    ["canceled, no end", { status: "canceled", validUntil: null }, false],
    ["revoked", { status: "revoked", validUntil: null }, false],
  ])("%s", (_name, p, expected) => {
    expect(isRowActive(row(p), now)).toBe(expected);
  });
});

describe("resolvePlan", () => {
  it.each<[string, EntitlementRow[], string]>([
    ["no rows", [], "free"],
    ["active sub", [row({})], "pro"],
    ["lifetime purchase", [row({ source: "purchase", validUntil: null, productKey: "asc_pro_lifetime" })], "lifetime"],
    ["refunded lifetime", [row({ source: "purchase", status: "revoked", validUntil: null })], "free"],
    ["expired sub", [row({ validUntil: past })], "free"],
    ["admin grant", [row({ source: "admin", validUntil: null })], "pro"],
    [
      "lifetime + active sub → pro (larger AI allowance)",
      [row({ source: "purchase", validUntil: null }), row({})],
      "pro",
    ],
    [
      "lifetime + canceled sub → lifetime",
      [row({ source: "purchase", validUntil: null }), row({ status: "canceled", validUntil: past })],
      "lifetime",
    ],
    ["digital entitlement only", [row({ entitlementKey: "sample_plan_pdf", source: "purchase", validUntil: null })], "free"],
  ])("%s", (_name, rows, expected) => {
    expect(resolvePlan(rows, now)).toBe(expected);
  });

  it("flags past_due", () => {
    expect(isPastDue([row({ status: "past_due" })], now)).toBe(true);
    expect(isPastDue([row({})], now)).toBe(false);
  });
});

describe("statusFromStripeSubscription", () => {
  it.each([
    ["active", "active"],
    ["trialing", "active"],
    ["past_due", "past_due"],
    ["canceled", "canceled"],
    ["unpaid", "canceled"],
    ["incomplete_expired", "canceled"],
    ["incomplete", "canceled"],
  ])("%s → %s", (stripe, ours) => {
    expect(statusFromStripeSubscription(stripe)).toBe(ours);
  });
});

describe("getPlanLimits", () => {
  it("matches the published pricing", () => {
    expect(getPlanLimits("free")).toMatchObject({ watermark: true, aiActions: 3, aiPeriod: "day", cloudPresets: false });
    expect(getPlanLimits("pro")).toMatchObject({ watermark: false, aiActions: 150, aiPeriod: "month", cloudPresets: true });
    expect(getPlanLimits("lifetime")).toMatchObject({ watermark: false, aiActions: 50, aiPeriod: "month", cloudPresets: true });
  });

  it("is env-overridable", () => {
    process.env.QUOTA_FREE_AI_PER_DAY = "7";
    try {
      expect(getPlanLimits("free").aiActions).toBe(7);
    } finally {
      delete process.env.QUOTA_FREE_AI_PER_DAY;
    }
  });
});
