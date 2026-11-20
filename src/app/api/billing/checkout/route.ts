import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/server";
import { getDb, isDbConfigured } from "@/db/client";
import { prices } from "@/db/schema";
import { findPrice, isPriceAvailable } from "@/lib/billing/catalog";
import * as repo from "@/lib/billing/repo";
import { getEntitlements } from "@/lib/billing/entitlements";
import { redundantPurchase } from "@/lib/billing/entitlement-rules";
import { requestOrigin } from "@/lib/billing/origin";
import { stripeMode } from "@/lib/billing/stripe-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ priceKey: z.string().min(1).max(64) });

async function stripePriceIdFor(priceKey: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: prices.stripePriceId })
    .from(prices)
    .where(eq(prices.priceKey, priceKey))
    .limit(1);
  if (row?.id) return row.id;
  const { findPriceIdByLookup } = await import("@/lib/billing/stripe");
  return findPriceIdByLookup(priceKey);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  if (stripeMode() === "unconfigured" || !isDbConfigured()) {
    return Response.json(
      { error: "Checkout is not configured on this deployment.", code: "billing_not_configured" },
      { status: 503 },
    );
  }

  let priceKey: string;
  try {
    priceKey = Body.parse(await request.json()).priceKey;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const hit = findPrice(priceKey);
  if (!hit || !isPriceAvailable(priceKey)) {
    return Response.json({ error: "Unknown price." }, { status: 400 });
  }

  const redundant = redundantPurchase(
    await getEntitlements(auth.user.id),
    hit.product.kind,
    hit.product.grants,
  );
  if (redundant) {
    const messages = {
      already_subscribed: "You already have Pro. Switch between monthly and yearly in Manage billing.",
      already_lifetime: "You already have Lifetime access — no need to buy again.",
      already_owned: "You already own this. Find it in your library.",
    } as const;
    return Response.json(
      { error: messages[redundant], code: redundant, manageUrl: "/account" },
      { status: 409 },
    );
  }

  try {
    const stripe = await import("@/lib/billing/stripe");
    let customerId = await repo.getStripeCustomerId(auth.user.id);
    if (!customerId) {
      customerId = await stripe.createCustomer({ userId: auth.user.id, email: auth.user.email });
      await repo.saveStripeCustomerId(auth.user.id, customerId);
    }
    const stripePriceId = await stripePriceIdFor(priceKey);
    if (!stripePriceId) {
      return Response.json(
        { error: "Price not set up in Stripe yet. Run npm run stripe:bootstrap.", code: "price_missing" },
        { status: 503 },
      );
    }
    const url = await stripe.createCheckoutSession({
      customerId,
      userId: auth.user.id,
      productKey: hit.product.key,
      priceKey,
      stripePriceId,
      recurring: hit.price.interval !== null,
      origin: requestOrigin(request),
    });
    if (!url) throw new Error("Stripe returned no checkout URL");
    return Response.json({ url });
  } catch (err) {
    console.error("[checkout]", err);
    return Response.json({ error: "Could not start checkout." }, { status: 502 });
  }
}
