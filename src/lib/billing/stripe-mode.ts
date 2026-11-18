/**
 * Live-key guard. Pure (no SDK import) so scripts, pages and tests can use it.
 *
 * Live keys are refused unless BOTH `ALLOW_LIVE_STRIPE=true` and
 * `NODE_ENV=production`. ALLOW_LIVE_STRIPE is OFF by default —
 * David flips this only after approval.
 */

export type StripeMode = "test" | "live" | "unconfigured";

export function stripeMode(key = process.env.STRIPE_SECRET_KEY): StripeMode {
  if (!key) return "unconfigured";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  return "live";
}

export function isLiveKeyAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ALLOW_LIVE_STRIPE === "true" && env.NODE_ENV === "production";
}

export class StripeNotConfiguredError extends Error {
  constructor(message = "Stripe not configured. Set STRIPE_SECRET_KEY (sk_test_…).") {
    super(message);
    this.name = "StripeNotConfiguredError";
  }
}

export class StripeLiveKeyRefusedError extends Error {
  constructor() {
    super(
      "Refusing to use a live Stripe key. Live mode requires ALLOW_LIVE_STRIPE=true and NODE_ENV=production (David-only, after approval).",
    );
    this.name = "StripeLiveKeyRefusedError";
  }
}

/** Throws unless the key is usable under the guard. Returns the key. */
export function assertUsableStripeKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = env.STRIPE_SECRET_KEY;
  const mode = stripeMode(key);
  if (mode === "unconfigured") throw new StripeNotConfiguredError();
  if (mode === "live" && !isLiveKeyAllowed(env)) throw new StripeLiveKeyRefusedError();
  return key!;
}
