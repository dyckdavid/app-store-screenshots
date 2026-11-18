import "server-only";
/** Drizzle-backed BillingStore bound to a single transaction. */
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { customers, entitlements, purchases, stripeEvents, usageEvents } from "@/db/schema";
import type { BillingStore } from "./webhook";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

function storeFor(tx: Tx): BillingStore {
  return {
    async recordEvent(id, type, payload) {
      const rows = await tx
        .insert(stripeEvents)
        .values({ id, type, payload: payload as object })
        .onConflictDoNothing()
        .returning({ id: stripeEvents.id });
      return rows.length > 0;
    },
    async findUserByCustomer(customerId) {
      const [row] = await tx
        .select({ userId: customers.userId })
        .from(customers)
        .where(eq(customers.stripeCustomerId, customerId))
        .limit(1);
      return row?.userId ?? null;
    },
    async linkCustomer(userId, customerId) {
      await tx
        .insert(customers)
        .values({ userId, stripeCustomerId: customerId })
        .onConflictDoNothing();
    },
    async insertPurchase(p) {
      const rows = await tx
        .insert(purchases)
        .values({
          userId: p.userId,
          productKey: p.productKey,
          stripeCheckoutSessionId: p.checkoutSessionId,
          stripePaymentIntent: p.paymentIntent,
          amountTotal: p.amountTotal,
          currency: p.currency,
          status: "paid",
        })
        .onConflictDoNothing()
        .returning({ id: purchases.id });
      return rows.length > 0;
    },
    async grantPurchaseEntitlement(e) {
      await tx
        .insert(entitlements)
        .values({
          userId: e.userId,
          entitlementKey: e.entitlementKey,
          source: "purchase",
          status: "active",
          validUntil: null,
          productKey: e.productKey,
          stripePaymentIntent: e.paymentIntent,
        })
        .onConflictDoNothing();
    },
    async addCredits(userId, units) {
      await tx.insert(usageEvents).values({ userId, kind: "credit", units });
    },
    async upsertSubscriptionEntitlement(e) {
      await tx
        .insert(entitlements)
        .values({
          userId: e.userId,
          entitlementKey: e.entitlementKey,
          source: "subscription",
          status: e.status,
          validUntil: e.validUntil,
          stripeSubscriptionId: e.subscriptionId,
          productKey: e.productKey,
          cancelAtPeriodEnd: e.cancelAtPeriodEnd,
        })
        .onConflictDoUpdate({
          target: [entitlements.stripeSubscriptionId, entitlements.entitlementKey],
          set: {
            status: e.status,
            validUntil: e.validUntil,
            cancelAtPeriodEnd: e.cancelAtPeriodEnd,
            updatedAt: new Date(),
          },
        });
    },
    async setSubscriptionStatus(subscriptionId, status, onlyIf) {
      const where = onlyIf?.length
        ? and(
            eq(entitlements.stripeSubscriptionId, subscriptionId),
            inArray(entitlements.status, onlyIf),
          )
        : eq(entitlements.stripeSubscriptionId, subscriptionId);
      await tx.update(entitlements).set({ status, updatedAt: new Date() }).where(where);
    },
    async refundPurchasesByPaymentIntent(paymentIntent) {
      return tx
        .update(purchases)
        .set({ status: "refunded", refundedAt: new Date() })
        .where(
          and(eq(purchases.stripePaymentIntent, paymentIntent), eq(purchases.status, "paid")),
        )
        .returning({ userId: purchases.userId, productKey: purchases.productKey });
    },
    async revokeEntitlementsByPaymentIntent(paymentIntent) {
      await tx
        .update(entitlements)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(entitlements.stripePaymentIntent, paymentIntent));
    },
  };
}

export function runBillingTransaction<T>(fn: (store: BillingStore) => Promise<T>): Promise<T> {
  return getDb().transaction((tx) => fn(storeFor(tx)));
}
