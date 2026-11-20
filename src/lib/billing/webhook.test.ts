import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import type { BillingStore } from "./webhook";
import { subscriptionPeriodEnd } from "./webhook";
import { resolvePlan, type EntitlementRow } from "./entitlement-rules";

// ---------------------------------------------------------------------------
// In-memory BillingStore with real transaction semantics (rollback on throw).
// ---------------------------------------------------------------------------
interface State {
  events: Map<string, string>;
  customers: Map<string, string>; // customerId → userId
  purchases: {
    userId: string;
    productKey: string;
    checkoutSessionId: string;
    paymentIntent: string | null;
    status: "paid" | "refunded";
  }[];
  entitlements: (EntitlementRow & {
    userId: string;
    subscriptionId: string | null;
    paymentIntent: string | null;
  })[];
  credits: { userId: string; units: number }[];
}

const db = vi.hoisted(() => ({ state: null as unknown as State }));

function emptyState(): State {
  return { events: new Map(), customers: new Map(), purchases: [], entitlements: [], credits: [] };
}

function clone(s: State): State {
  return {
    events: new Map(s.events),
    customers: new Map(s.customers),
    purchases: s.purchases.map((p) => ({ ...p })),
    entitlements: s.entitlements.map((e) => ({ ...e })),
    credits: s.credits.map((c) => ({ ...c })),
  };
}

function storeOn(s: State): BillingStore {
  return {
    async recordEvent(id, type) {
      if (s.events.has(id)) return false;
      s.events.set(id, type);
      return true;
    },
    async findUserByCustomer(c) {
      return s.customers.get(c) ?? null;
    },
    async linkCustomer(userId, c) {
      if (!s.customers.has(c)) s.customers.set(c, userId);
    },
    async insertPurchase(p) {
      if (s.purchases.some((x) => x.checkoutSessionId === p.checkoutSessionId)) return false;
      s.purchases.push({ ...p, status: "paid" });
      return true;
    },
    async grantPurchaseEntitlement(e) {
      s.entitlements.push({
        userId: e.userId,
        entitlementKey: e.entitlementKey,
        source: "purchase",
        status: "active",
        validUntil: null,
        productKey: e.productKey,
        subscriptionId: null,
        paymentIntent: e.paymentIntent,
      });
    },
    async addCredits(userId, units) {
      s.credits.push({ userId, units });
    },
    async upsertSubscriptionEntitlement(e) {
      const existing = s.entitlements.find(
        (x) => x.subscriptionId === e.subscriptionId && x.entitlementKey === e.entitlementKey,
      );
      if (existing) {
        Object.assign(existing, {
          status: e.status,
          validUntil: e.validUntil,
          cancelAtPeriodEnd: e.cancelAtPeriodEnd,
        });
      } else {
        s.entitlements.push({
          userId: e.userId,
          entitlementKey: e.entitlementKey,
          source: "subscription",
          status: e.status,
          validUntil: e.validUntil,
          productKey: e.productKey,
          cancelAtPeriodEnd: e.cancelAtPeriodEnd,
          subscriptionId: e.subscriptionId,
          paymentIntent: null,
        });
      }
    },
    async setSubscriptionStatus(subId, status, onlyIf) {
      for (const e of s.entitlements) {
        if (e.subscriptionId === subId && (!onlyIf || onlyIf.includes(e.status))) e.status = status;
      }
    },
    async refundPurchasesByPaymentIntent(pi) {
      const hit = s.purchases.filter((p) => p.paymentIntent === pi && p.status === "paid");
      hit.forEach((p) => (p.status = "refunded"));
      return hit.map((p) => ({ userId: p.userId, productKey: p.productKey }));
    },
    async revokeEntitlementsByPaymentIntent(pi) {
      for (const e of s.entitlements) if (e.paymentIntent === pi) e.status = "revoked";
    },
  };
}

vi.mock("./webhook-store", () => ({
  runBillingTransaction: async <T,>(fn: (store: BillingStore) => Promise<T>) => {
    const draft = clone(db.state);
    const result = await fn(storeOn(draft));
    db.state = draft; // commit
    return result;
  },
}));
vi.mock("@/db/client", () => ({ isDbConfigured: () => true }));

import { POST } from "@/app/api/stripe/webhook/route";

// ---------------------------------------------------------------------------
// Signed fixtures
// ---------------------------------------------------------------------------
const SECRET = "whsec_test_fixture_secret";
const signer = new Stripe("sk_test_fixture", { apiVersion: "2026-10-28.endive" });
const NOW = Math.floor(Date.now() / 1000);
const DAY = 86_400;
let seq = 0;

function event(type: string, object: Record<string, unknown>, id = `evt_${++seq}`) {
  return { id, object: "event", type, api_version: "2026-10-28.endive", created: NOW, data: { object } };
}

async function send(evt: object, opts: { badSig?: boolean } = {}) {
  const payload = JSON.stringify(evt);
  const header = signer.webhooks.generateTestHeaderString({
    payload,
    secret: opts.badSig ? "whsec_wrong" : SECRET,
  });
  const res = await POST(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": header, "content-type": "application/json" },
      body: payload,
    }),
  );
  return { status: res.status, body: (await res.json()) as { result?: string } };
}

function checkoutSession(p: {
  id: string;
  user: string;
  productKey: string;
  priceKey: string;
  mode?: "payment" | "subscription";
  paymentStatus?: "paid" | "unpaid";
  pi?: string;
  amount?: number;
}) {
  return {
    id: p.id,
    object: "checkout.session",
    mode: p.mode ?? "payment",
    payment_status: p.paymentStatus ?? "paid",
    customer: `cus_${p.user}`,
    client_reference_id: p.user,
    payment_intent: p.pi ?? `pi_${p.id}`,
    amount_total: p.amount ?? 3900,
    currency: "usd",
    metadata: { user_id: p.user, product_key: p.productKey, price_key: p.priceKey },
  };
}

function subscription(p: {
  id: string;
  user?: string;
  customer: string;
  status: string;
  periodEnd: number;
  cancelAtPeriodEnd?: boolean;
}) {
  return {
    id: p.id,
    object: "subscription",
    status: p.status,
    customer: p.customer,
    cancel_at_period_end: p.cancelAtPeriodEnd ?? false,
    metadata: p.user ? { user_id: p.user, product_key: "asc_pro", price_key: "asc_pro_monthly" } : {},
    items: {
      object: "list",
      data: [{ id: "si_1", object: "subscription_item", current_period_start: NOW, current_period_end: p.periodEnd }],
    },
  };
}

function invoice(subId: string) {
  return {
    id: `in_${++seq}`,
    object: "invoice",
    parent: { type: "subscription_details", subscription_details: { subscription: subId, metadata: {} } },
  };
}

function planOf(user: string) {
  return resolvePlan(db.state.entitlements.filter((e) => e.userId === user));
}

beforeEach(() => {
  db.state = emptyState();
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
});

describe("POST /api/stripe/webhook", () => {
  it("rejects a bad signature with 400", async () => {
    const r = await send(event("checkout.session.completed", {}), { badSig: true });
    expect(r.status).toBe(400);
    expect(db.state.events.size).toBe(0);
  });

  it("rejects a missing signature with 400", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
  });

  it("grants lifetime on paid checkout (valid_until = null)", async () => {
    const r = await send(
      event("checkout.session.completed", checkoutSession({ id: "cs_1", user: "u1", productKey: "asc_pro_lifetime", priceKey: "asc_pro_lifetime" })),
    );
    expect(r).toMatchObject({ status: 200, body: { result: "fulfilled" } });
    expect(db.state.purchases).toHaveLength(1);
    expect(db.state.entitlements[0]).toMatchObject({ entitlementKey: "asc_pro", validUntil: null, source: "purchase" });
    expect(planOf("u1")).toBe("lifetime");
    expect(db.state.customers.get("cus_u1")).toBe("u1");
  });

  it("is idempotent on replay of the same event id", async () => {
    const evt = event("checkout.session.completed", checkoutSession({ id: "cs_2", user: "u1", productKey: "asc_pro_lifetime", priceKey: "asc_pro_lifetime" }));
    await send(evt);
    const again = await send(evt);
    expect(again).toMatchObject({ status: 200, body: { result: "duplicate" } });
    expect(db.state.purchases).toHaveLength(1);
    expect(db.state.entitlements).toHaveLength(1);
  });

  it("does not double-grant when completed + async_succeeded both arrive", async () => {
    const session = checkoutSession({ id: "cs_3", user: "u1", productKey: "asc_pro_lifetime", priceKey: "asc_pro_lifetime" });
    await send(event("checkout.session.completed", session));
    await send(event("checkout.session.async_payment_succeeded", session));
    expect(db.state.purchases).toHaveLength(1);
    expect(db.state.entitlements).toHaveLength(1);
  });

  it("waits for async payment (e.g. OXXO): unpaid → no grant, succeeded → grant", async () => {
    const session = checkoutSession({ id: "cs_4", user: "u2", productKey: "asc_pro_lifetime", priceKey: "asc_pro_lifetime", paymentStatus: "unpaid" });
    const first = await send(event("checkout.session.completed", session));
    expect(first.body.result).toBe("awaiting_async_payment");
    expect(planOf("u2")).toBe("free");
    await send(event("checkout.session.async_payment_succeeded", { ...session, payment_status: "paid" }));
    expect(planOf("u2")).toBe("lifetime");
  });

  it("async_payment_failed grants nothing", async () => {
    const session = checkoutSession({ id: "cs_5", user: "u3", productKey: "asc_pro_lifetime", priceKey: "asc_pro_lifetime", paymentStatus: "unpaid" });
    await send(event("checkout.session.completed", session));
    const r = await send(event("checkout.session.async_payment_failed", session));
    expect(r.body.result).toBe("no_grant");
    expect(db.state.entitlements).toHaveLength(0);
    expect(db.state.purchases).toHaveLength(0);
  });

  it("subscription-mode checkout links the customer but grants nothing itself", async () => {
    await send(event("checkout.session.completed", checkoutSession({ id: "cs_6", user: "u4", productKey: "asc_pro", priceKey: "asc_pro_monthly", mode: "subscription" })));
    expect(db.state.customers.get("cus_u4")).toBe("u4");
    expect(db.state.entitlements).toHaveLength(0);
  });

  it("subscription lifecycle: created → past_due → paid → cancel at period end → deleted", async () => {
    const end = NOW + 30 * DAY;
    await send(event("customer.subscription.created", subscription({ id: "sub_1", user: "u5", customer: "cus_u5", status: "active", periodEnd: end })));
    expect(planOf("u5")).toBe("pro");
    expect(db.state.entitlements[0]!.validUntil?.getTime()).toBe(end * 1000);

    await send(event("invoice.payment_failed", invoice("sub_1")));
    expect(db.state.entitlements[0]!.status).toBe("past_due");
    expect(planOf("u5")).toBe("pro"); // grace

    await send(event("invoice.paid", invoice("sub_1")));
    expect(db.state.entitlements[0]!.status).toBe("active");

    await send(event("customer.subscription.updated", subscription({ id: "sub_1", user: "u5", customer: "cus_u5", status: "active", periodEnd: end, cancelAtPeriodEnd: true })));
    expect(db.state.entitlements[0]!.cancelAtPeriodEnd).toBe(true);
    expect(planOf("u5")).toBe("pro");

    await send(event("customer.subscription.deleted", subscription({ id: "sub_1", user: "u5", customer: "cus_u5", status: "canceled", periodEnd: end })));
    expect(db.state.entitlements[0]!.status).toBe("canceled");
    expect(planOf("u5")).toBe("pro"); // keeps access until valid_until
    expect(db.state.entitlements).toHaveLength(1); // upsert, not duplicate rows
  });

  it("deleted subscription past its period end → free", async () => {
    await send(event("customer.subscription.deleted", subscription({ id: "sub_2", user: "u6", customer: "cus_u6", status: "canceled", periodEnd: NOW - DAY })));
    expect(planOf("u6")).toBe("free");
  });

  it.each(["unpaid", "incomplete_expired"])("subscription status %s → canceled", async (status) => {
    await send(event("customer.subscription.updated", subscription({ id: `sub_${status}`, user: "u7", customer: "cus_u7", status, periodEnd: NOW + DAY })));
    expect(db.state.entitlements[0]!.status).toBe("canceled");
  });

  it("resolves the user via the customers table when metadata is missing", async () => {
    db.state.customers.set("cus_known", "u8");
    await send(event("customer.subscription.created", subscription({ id: "sub_3", customer: "cus_known", status: "trialing", periodEnd: NOW + DAY })));
    expect(planOf("u8")).toBe("pro");
  });

  it("returns 500 and rolls back (incl. the event id) when the user can't be resolved", async () => {
    const evt = event("customer.subscription.created", subscription({ id: "sub_4", customer: "cus_unknown", status: "active", periodEnd: NOW + DAY }));
    const r = await send(evt);
    expect(r.status).toBe(500);
    expect(db.state.events.has(evt.id)).toBe(false); // Stripe retry will reprocess
    expect(db.state.entitlements).toHaveLength(0);
  });

  it("charge.refunded revokes lifetime", async () => {
    await send(event("checkout.session.completed", checkoutSession({ id: "cs_7", user: "u9", productKey: "asc_pro_lifetime", priceKey: "asc_pro_lifetime", pi: "pi_life" })));
    expect(planOf("u9")).toBe("lifetime");
    const r = await send(event("charge.refunded", { id: "ch_1", object: "charge", payment_intent: "pi_life", refunded: true, amount: 3900, amount_refunded: 3900 }));
    expect(r.body.result).toBe("refund_revoked");
    expect(db.state.purchases[0]!.status).toBe("refunded");
    expect(planOf("u9")).toBe("free");
  });

  it("charge.refunded revokes digital entitlements and claws back credits", async () => {
    await send(event("checkout.session.completed", checkoutSession({ id: "cs_8", user: "u10", productKey: "sample_plan_pdf", priceKey: "sample_plan_pdf", pi: "pi_pdf", amount: 500 })));
    expect(db.state.entitlements[0]).toMatchObject({ entitlementKey: "sample_plan_pdf", status: "active" });
    await send(event("checkout.session.completed", checkoutSession({ id: "cs_9", user: "u10", productKey: "asc_ai_pack_50", priceKey: "asc_ai_pack_50", pi: "pi_ai", amount: 500 })));
    expect(db.state.credits).toEqual([{ userId: "u10", units: 50 }]);

    await send(event("charge.refunded", { id: "ch_2", object: "charge", payment_intent: "pi_pdf", refunded: true }));
    await send(event("charge.refunded", { id: "ch_3", object: "charge", payment_intent: "pi_ai", refunded: true }));
    expect(db.state.entitlements[0]!.status).toBe("revoked");
    expect(db.state.credits.reduce((n, c) => n + c.units, 0)).toBe(0);
  });

  it("ignores partial refunds", async () => {
    await send(event("checkout.session.completed", checkoutSession({ id: "cs_10", user: "u11", productKey: "asc_pro_lifetime", priceKey: "asc_pro_lifetime", pi: "pi_partial" })));
    const r = await send(event("charge.refunded", { id: "ch_4", object: "charge", payment_intent: "pi_partial", refunded: false }));
    expect(r.body.result).toBe("partial_refund_ignored");
    expect(planOf("u11")).toBe("lifetime");
  });

  it("acknowledges unknown events with 200", async () => {
    const r = await send(event("customer.created", { id: "cus_x", object: "customer" }));
    expect(r).toMatchObject({ status: 200, body: { result: "ignored" } });
  });
});

describe("subscriptionPeriodEnd (API 2026-10-28.endive: period on items)", () => {
  it("uses the latest item current_period_end", () => {
    const sub = {
      items: { data: [{ current_period_end: 100 }, { current_period_end: 300 }] },
    } as unknown as Stripe.Subscription;
    expect(subscriptionPeriodEnd(sub)?.getTime()).toBe(300_000);
  });
  it("returns null without items", () => {
    expect(subscriptionPeriodEnd({ items: { data: [] } } as unknown as Stripe.Subscription)).toBeNull();
  });
});
