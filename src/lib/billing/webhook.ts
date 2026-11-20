/**
 * Stripe webhook processing. Entitlements change ONLY here (verified events),
 * never from the checkout success redirect.
 *
 * Pure w.r.t. infrastructure: persistence goes through `BillingStore`, so the
 * whole flow is unit-tested with an in-memory store and signed fixtures.
 */
import type Stripe from "stripe";
import { findPrice, findProduct, ENTITLEMENT_PRO } from "./catalog";
import { statusFromStripeSubscription, type EntitlementStatus } from "./entitlement-rules";

export interface BillingStore {
  /** Insert the event id; false if it already exists (replay). */
  recordEvent(id: string, type: string, payload: unknown): Promise<boolean>;
  findUserByCustomer(customerId: string): Promise<string | null>;
  linkCustomer(userId: string, customerId: string): Promise<void>;
  /** false if this checkout session was already recorded. */
  insertPurchase(p: {
    userId: string;
    productKey: string;
    checkoutSessionId: string;
    paymentIntent: string | null;
    amountTotal: number;
    currency: string;
  }): Promise<boolean>;
  grantPurchaseEntitlement(e: {
    userId: string;
    entitlementKey: string;
    productKey: string;
    paymentIntent: string | null;
  }): Promise<void>;
  addCredits(userId: string, units: number): Promise<void>;
  upsertSubscriptionEntitlement(e: {
    userId: string;
    subscriptionId: string;
    entitlementKey: string;
    productKey: string;
    status: EntitlementStatus;
    validUntil: Date | null;
    cancelAtPeriodEnd: boolean;
  }): Promise<void>;
  setSubscriptionStatus(
    subscriptionId: string,
    status: EntitlementStatus,
    onlyIf?: EntitlementStatus[],
  ): Promise<void>;
  /** Marks purchases refunded; returns the affected purchases. */
  refundPurchasesByPaymentIntent(
    paymentIntent: string,
  ): Promise<{ userId: string; productKey: string }[]>;
  revokeEntitlementsByPaymentIntent(paymentIntent: string): Promise<void>;
}

export type WebhookOutcome = { status: number; body: Record<string, unknown> };

function idOf(x: string | { id: string } | null | undefined): string | null {
  if (!x) return null;
  return typeof x === "string" ? x : x.id;
}

/**
 * Period end for the pinned API version (2026-10-28.endive): Stripe moved
 * `current_period_end` from the Subscription onto each SubscriptionItem
 * (API 2025-03-31.basil+). Use the latest item period end.
 */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const ends = (sub.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((n): n is number => typeof n === "number");
  if (ends.length === 0) return null;
  return new Date(Math.max(...ends) * 1000);
}

async function resolveUserId(
  store: BillingStore,
  metadata: Stripe.Metadata | null | undefined,
  customer: string | { id: string } | null | undefined,
  clientReferenceId?: string | null,
): Promise<string | null> {
  const fromMeta = metadata?.user_id || clientReferenceId;
  if (fromMeta) return fromMeta;
  const customerId = idOf(customer);
  return customerId ? store.findUserByCustomer(customerId) : null;
}

async function fulfillPaidCheckout(store: BillingStore, session: Stripe.Checkout.Session) {
  const userId = await resolveUserId(store, session.metadata, session.customer, session.client_reference_id);
  if (!userId) throw new Error(`checkout ${session.id}: cannot resolve user`);
  const customerId = idOf(session.customer);
  if (customerId) await store.linkCustomer(userId, customerId);

  if (session.mode === "subscription") return; // entitlement comes from subscription events

  const productKey =
    session.metadata?.product_key ??
    (session.metadata?.price_key ? findPrice(session.metadata.price_key)?.product.key : undefined);
  const product = productKey ? findProduct(productKey) : null;
  if (!product) throw new Error(`checkout ${session.id}: unknown product ${productKey}`);

  const paymentIntent = idOf(session.payment_intent);
  const inserted = await store.insertPurchase({
    userId,
    productKey: product.key,
    checkoutSessionId: session.id,
    paymentIntent,
    amountTotal: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
  });
  if (!inserted) return; // already fulfilled (e.g. completed + async_succeeded)

  if (product.kind === "credits") {
    await store.addCredits(userId, product.credits ?? 0);
  } else {
    await store.grantPurchaseEntitlement({
      userId,
      entitlementKey: product.grants,
      productKey: product.key,
      paymentIntent,
    });
  }
}

async function syncSubscription(store: BillingStore, sub: Stripe.Subscription, deleted: boolean) {
  const userId = await resolveUserId(store, sub.metadata, sub.customer);
  if (!userId) throw new Error(`subscription ${sub.id}: cannot resolve user`);
  const customerId = idOf(sub.customer);
  if (customerId) await store.linkCustomer(userId, customerId);

  const productKey = sub.metadata?.product_key || "asc_pro";
  const product = findProduct(productKey);
  await store.upsertSubscriptionEntitlement({
    userId,
    subscriptionId: sub.id,
    entitlementKey: product?.grants ?? ENTITLEMENT_PRO,
    productKey,
    status: deleted ? "canceled" : statusFromStripeSubscription(sub.status),
    validUntil: subscriptionPeriodEnd(sub),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  });
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const details = invoice.parent?.subscription_details;
  return details ? idOf(details.subscription) : null;
}

/** Dispatch one verified event. Throws → caller rolls back + returns 500. */
export async function applyStripeEvent(store: BillingStore, event: Stripe.Event): Promise<string> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // Async methods (e.g. OXXO) complete as "unpaid"; wait for async_payment_succeeded.
      if (session.mode === "payment" && session.payment_status !== "paid") {
        const userId = await resolveUserId(store, session.metadata, session.customer, session.client_reference_id);
        const customerId = idOf(session.customer);
        if (userId && customerId) await store.linkCustomer(userId, customerId);
        return "awaiting_async_payment";
      }
      await fulfillPaidCheckout(store, session);
      return "fulfilled";
    }
    case "checkout.session.async_payment_succeeded":
      await fulfillPaidCheckout(store, event.data.object);
      return "fulfilled";
    case "checkout.session.async_payment_failed":
      return "no_grant";
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await syncSubscription(store, event.data.object, false);
      return "subscription_synced";
    case "customer.subscription.deleted":
      await syncSubscription(store, event.data.object, true);
      return "subscription_canceled";
    case "invoice.payment_failed": {
      const subId = invoiceSubscriptionId(event.data.object);
      if (subId) await store.setSubscriptionStatus(subId, "past_due", ["active", "past_due"]);
      return "past_due";
    }
    case "invoice.paid": {
      const subId = invoiceSubscriptionId(event.data.object);
      if (subId) await store.setSubscriptionStatus(subId, "active", ["past_due"]);
      return "paid";
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const pi = idOf(charge.payment_intent);
      // Only a full refund revokes access; partial refunds are goodwill.
      if (!pi || !charge.refunded) return "partial_refund_ignored";
      const refunded = await store.refundPurchasesByPaymentIntent(pi);
      await store.revokeEntitlementsByPaymentIntent(pi);
      for (const p of refunded) {
        const product = findProduct(p.productKey);
        if (product?.kind === "credits" && product.credits) {
          await store.addCredits(p.userId, -product.credits);
        }
      }
      return "refund_revoked";
    }
    default:
      console.info(`[stripe] unhandled event type ${event.type} (${event.id})`);
      return "ignored";
  }
}

/**
 * Full pipeline after signature verification: idempotency + transaction.
 * `runInTransaction` gives a store bound to one DB transaction; throwing
 * inside rolls back everything, including the stripe_events insert, so
 * Stripe's retry will process the event again.
 */
export async function processStripeEvent(
  event: Stripe.Event,
  runInTransaction: <T>(fn: (store: BillingStore) => Promise<T>) => Promise<T>,
): Promise<WebhookOutcome> {
  try {
    const result = await runInTransaction(async (store) => {
      const fresh = await store.recordEvent(event.id, event.type, event);
      if (!fresh) return "duplicate";
      return applyStripeEvent(store, event);
    });
    return { status: 200, body: { received: true, result } };
  } catch (err) {
    console.error(`[stripe] handler failed for ${event.type} ${event.id}`, err);
    return { status: 500, body: { error: "Webhook handler failed" } };
  }
}
