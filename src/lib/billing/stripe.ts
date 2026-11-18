import "server-only";
/**
 * The ONLY module that talks to Stripe. Lazy client, pinned API version,
 * live-key guard (see stripe-mode.ts). Throws StripeNotConfiguredError only
 * when actually used, so builds/tests without env are fine.
 */
import Stripe from "stripe";
import { assertUsableStripeKey, StripeNotConfiguredError } from "./stripe-mode";

/** Pinned to the version bundled with stripe@23.1.0. */
export const STRIPE_API_VERSION = "2026-10-28.endive" as const;

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const key = assertUsableStripeKey();
  client = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: "asc-studio" },
    maxNetworkRetries: 2,
  });
  return client;
}

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

/** Verify + parse. Throws WebhookSignatureError (→ 400) on a bad signature. */
export function verifyWebhookEvent(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new StripeNotConfiguredError("STRIPE_WEBHOOK_SECRET is not set.");
  if (!signature) throw new WebhookSignatureError("Missing stripe-signature header");
  // Signature verification is a local HMAC check that never calls the API,
  // so a placeholder key is enough (and no secret key is ever needed here).
  const verifier = new Stripe("sk_test_placeholder_for_webhook_verification", {
    apiVersion: STRIPE_API_VERSION,
  });
  try {
    return verifier.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    throw new WebhookSignatureError(err instanceof Error ? err.message : "Invalid signature");
  }
}

// ---- checkout / portal --------------------------------------------------

export async function createCustomer(params: { userId: string; email: string | null }) {
  const customer = await getStripe().customers.create({
    email: params.email ?? undefined,
    metadata: { user_id: params.userId },
  });
  return customer.id;
}

export async function findPriceIdByLookup(priceKey: string): Promise<string | null> {
  const res = await getStripe().prices.list({ lookup_keys: [priceKey], active: true, limit: 1 });
  return res.data[0]?.id ?? null;
}

export interface CheckoutInput {
  customerId: string;
  userId: string;
  productKey: string;
  priceKey: string;
  stripePriceId: string;
  recurring: boolean;
  origin: string;
}

export function buildCheckoutParams(input: CheckoutInput): Stripe.Checkout.SessionCreateParams {
  const metadata = {
    user_id: input.userId,
    product_key: input.productKey,
    price_key: input.priceKey,
  };
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: input.recurring ? "subscription" : "payment",
    customer: input.customerId,
    client_reference_id: input.userId,
    line_items: [{ price: input.stripePriceId, quantity: 1 }],
    metadata,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: `${input.origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/pricing`,
  };
  if (input.recurring) {
    params.subscription_data = { metadata };
  } else {
    params.payment_intent_data = { metadata };
    params.customer_update = { address: "auto" };
  }
  if (process.env.STRIPE_TAX_ENABLED === "true") {
    params.automatic_tax = { enabled: true };
    params.customer_update = { address: "auto", name: "auto" };
  }
  return params;
}

export async function createCheckoutSession(input: CheckoutInput) {
  const session = await getStripe().checkout.sessions.create(buildCheckoutParams(input));
  return session.url;
}

export async function createPortalSession(customerId: string, origin: string) {
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/account`,
    ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID
      ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID }
      : {}),
  });
  return session.url;
}

export type { Stripe };
