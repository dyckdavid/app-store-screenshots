import { verifyWebhookEvent, WebhookSignatureError } from "@/lib/billing/stripe";
import { StripeNotConfiguredError } from "@/lib/billing/stripe-mode";
import { processStripeEvent } from "@/lib/billing/webhook";
import { runBillingTransaction } from "@/lib/billing/webhook-store";
import { isDbConfigured } from "@/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Raw body is required for signature verification.
  const raw = await request.text();
  let event;
  try {
    event = verifyWebhookEvent(raw, request.headers.get("stripe-signature"));
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }
    if (err instanceof StripeNotConfiguredError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }
  if (!isDbConfigured()) {
    // 500 → Stripe retries once the DB is configured.
    return Response.json({ error: "Database not configured" }, { status: 500 });
  }
  const outcome = await processStripeEvent(event, runBillingTransaction);
  return Response.json(outcome.body, { status: outcome.status });
}
