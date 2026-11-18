import { requireUser } from "@/lib/auth/server";
import { isDbConfigured } from "@/db/client";
import * as repo from "@/lib/billing/repo";
import { requestOrigin } from "@/lib/billing/origin";
import { stripeMode } from "@/lib/billing/stripe-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (stripeMode() === "unconfigured" || !isDbConfigured()) {
    return Response.json({ error: "Billing is not configured." }, { status: 503 });
  }
  const customerId = await repo.getStripeCustomerId(auth.user.id);
  if (!customerId) {
    return Response.json({ error: "No billing account yet." }, { status: 404 });
  }
  try {
    const { createPortalSession } = await import("@/lib/billing/stripe");
    const url = await createPortalSession(customerId, requestOrigin(request));
    return Response.json({ url });
  } catch (err) {
    console.error("[portal]", err);
    return Response.json({ error: "Could not open the billing portal." }, { status: 502 });
  }
}
