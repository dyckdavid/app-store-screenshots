/**
 * Plan limits — the one place quotas live. Every number is env-overridable.
 * Pure module (no server imports) so the client can import types/decisions.
 */

export type Plan = "free" | "pro" | "lifetime";
export type QuotaPeriod = "day" | "month";

export interface PlanLimits {
  watermark: boolean;
  aiActions: number;
  aiPeriod: QuotaPeriod;
  cloudPresets: boolean;
}

function envInt(name: string, fallback: number): number {
  const raw = typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getPlanLimits(plan: Plan): PlanLimits {
  switch (plan) {
    case "pro":
      return {
        watermark: false,
        aiActions: envInt("QUOTA_PRO_AI_PER_MONTH", 150),
        aiPeriod: "month",
        cloudPresets: true,
      };
    case "lifetime":
      return {
        watermark: false,
        aiActions: envInt("QUOTA_LIFETIME_AI_PER_MONTH", 50),
        aiPeriod: "month",
        cloudPresets: true,
      };
    default:
      return {
        watermark: true,
        aiActions: envInt("QUOTA_FREE_AI_PER_DAY", 3),
        aiPeriod: "day",
        cloudPresets: false,
      };
  }
}

/** Free (and anonymous) exports carry the badge; paid plans don't. */
export function shouldWatermark(plan: Plan | null | undefined): boolean {
  return getPlanLimits(plan ?? "free").watermark;
}

/** Start of the current quota window in UTC. */
export function quotaWindowStart(period: QuotaPeriod, now = new Date()): Date {
  if (period === "day") {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
