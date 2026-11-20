import "server-only";
/**
 * DB-backed AI quotas (usage_events). Free = per UTC day, paid = per UTC month.
 * Reserve-first: we insert the usage row, then re-count; if that pushed the
 * user over, we delete it and deny. This keeps concurrent requests from
 * overshooting. Callers `release()` the reservation if the AI call fails.
 */
import * as repo from "./repo";
import { getUserPlan } from "./entitlements";
import { quotaWindowStart, type Plan, type QuotaPeriod } from "./plans";

export type QuotaKind = "analyze" | "copy" | "generate-image" | "layout" | "review";

export interface QuotaSnapshot {
  plan: Plan;
  used: number;
  limit: number;
  credits: number;
  period: QuotaPeriod;
  resetsAt: string;
}

export type ConsumeResult =
  | { ok: true; snapshot: QuotaSnapshot; release: () => Promise<void> }
  | { ok: false; snapshot: QuotaSnapshot };

function nextReset(period: QuotaPeriod, now = new Date()): Date {
  const start = quotaWindowStart(period, now);
  return period === "day"
    ? new Date(start.getTime() + 86_400_000)
    : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}

export async function getQuotaSnapshot(userId: string, now = new Date()): Promise<QuotaSnapshot> {
  const { plan, limits } = await getUserPlan(userId);
  const since = quotaWindowStart(limits.aiPeriod, now);
  const [used, credits] = await Promise.all([
    repo.countAllowanceUsage(userId, since),
    repo.creditBalance(userId),
  ]);
  return {
    plan,
    used,
    limit: limits.aiActions,
    credits: Math.max(0, credits),
    period: limits.aiPeriod,
    resetsAt: nextReset(limits.aiPeriod, now).toISOString(),
  };
}

export async function consumeQuota(
  userId: string,
  kind: QuotaKind,
  now = new Date(),
): Promise<ConsumeResult> {
  const before = await getQuotaSnapshot(userId, now);
  const since = quotaWindowStart(before.period, now);

  // 1) Try the plan allowance.
  if (before.used < before.limit) {
    const id = await repo.insertUsage(userId, `ai:${kind}`);
    const used = await repo.countAllowanceUsage(userId, since);
    if (used <= before.limit) {
      return {
        ok: true,
        snapshot: { ...before, used },
        release: () => repo.deleteUsage(id),
      };
    }
    await repo.deleteUsage(id); // lost a race; fall through to credits
  }

  // 2) Fall back to purchased credits.
  if (before.credits > 0) {
    const id = await repo.insertUsage(userId, `ai_credit:${kind}`);
    const credits = await repo.creditBalance(userId);
    if (credits >= 0) {
      return {
        ok: true,
        snapshot: { ...before, used: before.limit, credits },
        release: () => repo.deleteUsage(id),
      };
    }
    await repo.deleteUsage(id);
  }

  return { ok: false, snapshot: { ...before, used: Math.max(before.used, before.limit) } };
}

/** JSON body for a denied request — rendered by the editor's paywall. */
export function quotaExceededBody(snapshot: QuotaSnapshot) {
  const upgrade = snapshot.plan === "free";
  return {
    error: upgrade
      ? `You've used your ${snapshot.limit} free AI actions for today. Upgrade for more.`
      : `You've used all ${snapshot.limit} AI actions for this month.`,
    code: "quota_exceeded" as const,
    plan: snapshot.plan,
    used: snapshot.used,
    limit: snapshot.limit,
    period: snapshot.period,
    resetsAt: snapshot.resetsAt,
    upgradeUrl: upgrade ? "/pricing" : null,
  };
}
