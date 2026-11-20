import { isAuthConfigured } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/server";
import { isDbConfigured } from "@/db/client";
import { stripeMode } from "@/lib/billing/stripe-mode";
import { getUserPlan } from "@/lib/billing/entitlements";
import { getPlanLimits } from "@/lib/billing/plans";
import { getQuotaSnapshot } from "@/lib/billing/quota";

export const dynamic = "force-dynamic";

/** `{ signedIn, plan, limits, usage }` for the editor's useEntitlements(). */
export async function GET() {
  const authConfigured = isAuthConfigured();
  const user = authConfigured ? await getSessionUser() : null;
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  const userInfo = user ? { email: user.email, name: user.name } : null;
  const billingEnabled = stripeMode() !== "unconfigured" && isDbConfigured();

  if (!user || !isDbConfigured()) {
    return Response.json(
      {
        signedIn: Boolean(user),
        user: userInfo,
        authConfigured,
        billingEnabled,
        plan: "free",
        limits: getPlanLimits("free"),
        usage: null,
        pastDue: false,
      },
      { headers },
    );
  }

  try {
    const [{ plan, limits, pastDue }, quota] = await Promise.all([
      getUserPlan(user.id),
      getQuotaSnapshot(user.id),
    ]);
    return Response.json(
      {
        signedIn: true,
        user: userInfo,
        authConfigured,
        billingEnabled,
        plan,
        limits,
        pastDue,
        usage: {
          aiUsed: quota.used,
          aiLimit: quota.limit,
          aiCredits: quota.credits,
          period: quota.period,
        },
      },
      { headers },
    );
  } catch {
    // DB hiccup: fail closed to free (watermark on), never to paid.
    return Response.json(
      {
        signedIn: true,
        user: userInfo,
        authConfigured,
        billingEnabled,
        plan: "free",
        limits: getPlanLimits("free"),
        usage: null,
        pastDue: false,
      },
      { headers },
    );
  }
}
