"use client";

import { track as vercelTrack } from "@vercel/analytics";

/**
 * Typed product analytics (Vercel Web Analytics). NO PII: only coarse,
 * non-identifying properties (counts, plan, product keys).
 */
export type AnalyticsEvent =
  | { name: "upload"; props: { count: number } }
  | { name: "export"; props: { count: number; plan: string; watermark: boolean } }
  | { name: "paywall_view"; props: { reason: string } }
  | { name: "checkout_started"; props: { priceKey: string } }
  | { name: "checkout_success"; props: Record<string, never> };

export function track<E extends AnalyticsEvent>(name: E["name"], props: E["props"]): void {
  try {
    vercelTrack(name, props as Record<string, string | number | boolean>);
  } catch {
    // analytics must never break the app
  }
}
