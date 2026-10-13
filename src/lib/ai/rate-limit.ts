/**
 * In-memory rate limiter for xAI routes.
 *
 * Caps: per-IP per minute, per-IP per day, and a global daily budget.
 * Suitable for single-instance / low-traffic deploys. Multi-instance
 * production should replace this with a shared store (Redis / KV).
 */

import { getRateLimitConfig } from "./config";

type Bucket = {
  minuteWindowStart: number;
  minuteCount: number;
  dayKey: string;
  dayCount: number;
};

const ipBuckets = new Map<string, Bucket>();
let globalDayKey = "";
let globalDayCount = 0;

function utcDayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function minuteWindow(now = Date.now()): number {
  return Math.floor(now / 60_000);
}

export type RateLimitResult =
  | { ok: true; remaining: { minute: number; day: number; global: number } }
  | {
      ok: false;
      status: 429;
      error: string;
      retryAfterSeconds: number;
    };

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function consumeRateLimit(ip: string): RateLimitResult {
  const caps = getRateLimitConfig();
  const now = Date.now();
  const day = utcDayKey(now);
  const minute = minuteWindow(now);

  if (globalDayKey !== day) {
    globalDayKey = day;
    globalDayCount = 0;
  }

  let bucket = ipBuckets.get(ip);
  if (!bucket || bucket.dayKey !== day) {
    bucket = {
      minuteWindowStart: minute,
      minuteCount: 0,
      dayKey: day,
      dayCount: 0,
    };
    ipBuckets.set(ip, bucket);
  } else if (bucket.minuteWindowStart !== minute) {
    bucket.minuteWindowStart = minute;
    bucket.minuteCount = 0;
  }

  if (bucket.minuteCount >= caps.perIpPerMinute) {
    const retryAfterSeconds = 60 - (Math.floor(now / 1000) % 60);
    return {
      ok: false,
      status: 429,
      error: `Rate limit: max ${caps.perIpPerMinute} AI requests per IP per minute.`,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  if (bucket.dayCount >= caps.perIpPerDay) {
    return {
      ok: false,
      status: 429,
      error: `Daily limit: max ${caps.perIpPerDay} AI requests per IP per day.`,
      retryAfterSeconds: secondsUntilUtcMidnight(now),
    };
  }

  if (globalDayCount >= caps.globalPerDay) {
    return {
      ok: false,
      status: 429,
      error: `Global daily AI budget reached (${caps.globalPerDay} requests).`,
      retryAfterSeconds: secondsUntilUtcMidnight(now),
    };
  }

  bucket.minuteCount += 1;
  bucket.dayCount += 1;
  globalDayCount += 1;
  ipBuckets.set(ip, bucket);

  return {
    ok: true,
    remaining: {
      minute: Math.max(0, caps.perIpPerMinute - bucket.minuteCount),
      day: Math.max(0, caps.perIpPerDay - bucket.dayCount),
      global: Math.max(0, caps.globalPerDay - globalDayCount),
    },
  };
}

function secondsUntilUtcMidnight(now: number): number {
  const d = new Date(now);
  const next = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(1, Math.ceil((next - now) / 1000));
}

/** Test helper — clears in-memory counters. */
export function resetRateLimitStoreForTests(): void {
  ipBuckets.clear();
  globalDayKey = "";
  globalDayCount = 0;
}
