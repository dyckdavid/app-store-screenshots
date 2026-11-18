import "server-only";
/**
 * Gate for every metered /api/ai/* route:
 *   1. AI configured?           → 503
 *   2. signed in? (Neon Auth)   → 401 / 503 if accounts not configured
 *   3. per-IP abuse limiter     → 429 (existing in-memory limiter, secondary)
 *   4. DB quota (usage_events)  → 402 quota_exceeded / 503 if DB missing
 */
import { isAiConfigured } from "./config";
import { clientIpFromRequest, consumeRateLimit, type RateLimitResult } from "./rate-limit";
import { requireUser, type SessionUser } from "@/lib/auth/server";
import { isDbConfigured } from "@/db/client";
import { consumeQuota, quotaExceededBody, type QuotaKind, type QuotaSnapshot } from "@/lib/billing/quota";

export type AiGateResult =
  | {
      ok: true;
      user: SessionUser;
      limited: Extract<RateLimitResult, { ok: true }>;
      quota: QuotaSnapshot;
      /** Give the unit back if the AI call failed. Safe to call twice. */
      release: () => Promise<void>;
    }
  | { ok: false; response: Response };

export async function gateAiRequest(request: Request, kind: QuotaKind): Promise<AiGateResult> {
  if (!isAiConfigured()) {
    return {
      ok: false,
      response: Response.json(
        {
          error:
            "AI features are disabled. Set AI_GATEWAY_API_KEY (or OIDC on Vercel) or XAI_API_KEY.",
          code: "ai_not_configured",
        },
        { status: 503 },
      ),
    };
  }

  const auth = await requireUser();
  if (!auth.ok) return auth;

  if (!isDbConfigured()) {
    return {
      ok: false,
      response: Response.json(
        { error: "AI quotas are not configured (DATABASE_URL).", code: "quota_not_configured" },
        { status: 503 },
      ),
    };
  }

  const limited = consumeRateLimit(clientIpFromRequest(request));
  if (!limited.ok) {
    return {
      ok: false,
      response: Response.json(
        { error: limited.error, code: "rate_limited" },
        { status: limited.status, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
      ),
    };
  }

  const consumed = await consumeQuota(auth.user.id, kind);
  if (!consumed.ok) {
    return {
      ok: false,
      response: Response.json(quotaExceededBody(consumed.snapshot), { status: 402 }),
    };
  }

  let released = false;
  return {
    ok: true,
    user: auth.user,
    limited,
    quota: consumed.snapshot,
    release: async () => {
      if (released) return;
      released = true;
      try {
        await consumed.release();
      } catch {
        // best effort
      }
    },
  };
}
