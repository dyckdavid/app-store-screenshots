import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntitlementRow } from "./entitlement-rules";

/** In-memory stand-in for the repo (mocked at the module boundary). */
const store = vi.hoisted(() => ({
  usage: [] as { id: number; userId: string; kind: string; units: number; createdAt: Date }[],
  entitlements: [] as (EntitlementRow & { userId: string })[],
  nextId: 1,
}));

vi.mock("./repo", () => ({
  listEntitlements: async (userId: string) => store.entitlements.filter((e) => e.userId === userId),
  countAllowanceUsage: async (userId: string, since: Date) =>
    store.usage
      .filter((u) => u.userId === userId && u.kind.startsWith("ai:") && u.createdAt >= since)
      .reduce((n, u) => n + u.units, 0),
  creditBalance: async (userId: string) => {
    const mine = store.usage.filter((u) => u.userId === userId);
    const granted = mine.filter((u) => u.kind === "credit").reduce((n, u) => n + u.units, 0);
    const spent = mine.filter((u) => u.kind.startsWith("ai_credit:")).reduce((n, u) => n + u.units, 0);
    return granted - spent;
  },
  insertUsage: async (userId: string, kind: string, units = 1) => {
    const id = store.nextId++;
    store.usage.push({ id, userId, kind, units, createdAt: new Date() });
    return id;
  },
  deleteUsage: async (id: number) => {
    store.usage = store.usage.filter((u) => u.id !== id);
  },
}));

import { consumeQuota, getQuotaSnapshot, quotaExceededBody } from "./quota";

beforeEach(() => {
  store.usage = [];
  store.entitlements = [];
  store.nextId = 1;
});

describe("consumeQuota", () => {
  it("free users get 3 per day, then are denied", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await consumeQuota("u1", "copy");
      expect(r.ok).toBe(true);
    }
    const denied = await consumeQuota("u1", "copy");
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      const body = quotaExceededBody(denied.snapshot);
      expect(body.code).toBe("quota_exceeded");
      expect(body.upgradeUrl).toBe("/pricing");
      expect(body.period).toBe("day");
    }
  });

  it("does not count usage from previous days", async () => {
    store.usage.push(
      ...[1, 2, 3].map((id) => ({
        id,
        userId: "u1",
        kind: "ai:copy",
        units: 1,
        createdAt: new Date(Date.now() - 2 * 86_400_000),
      })),
    );
    store.nextId = 10;
    expect((await consumeQuota("u1", "copy")).ok).toBe(true);
  });

  it("pro users get 150/month", async () => {
    store.entitlements.push({
      userId: "pro",
      entitlementKey: "asc_pro",
      source: "subscription",
      status: "active",
      validUntil: new Date(Date.now() + 86_400_000 * 20),
      productKey: "asc_pro",
    });
    const snap = await getQuotaSnapshot("pro");
    expect(snap).toMatchObject({ plan: "pro", limit: 150, period: "month" });
  });

  it("release() refunds the unit", async () => {
    const r = await consumeQuota("u1", "review");
    expect(r.ok).toBe(true);
    if (r.ok) await r.release();
    expect(store.usage).toHaveLength(0);
  });

  it("falls back to purchased credits after the allowance", async () => {
    store.usage.push({ id: 99, userId: "u1", kind: "credit", units: 2, createdAt: new Date() });
    store.nextId = 100;
    for (let i = 0; i < 3; i++) await consumeQuota("u1", "copy");
    expect((await consumeQuota("u1", "copy")).ok).toBe(true); // credit 1
    expect((await consumeQuota("u1", "copy")).ok).toBe(true); // credit 2
    expect((await consumeQuota("u1", "copy")).ok).toBe(false);
  });

  it("isolates users", async () => {
    for (let i = 0; i < 3; i++) await consumeQuota("a", "copy");
    expect((await consumeQuota("b", "copy")).ok).toBe(true);
  });
});
