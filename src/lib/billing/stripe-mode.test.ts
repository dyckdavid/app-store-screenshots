import { describe, expect, it } from "vitest";
import {
  assertUsableStripeKey,
  StripeLiveKeyRefusedError,
  StripeNotConfiguredError,
  stripeMode,
} from "./stripe-mode";

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

describe("live-key guard", () => {
  it("detects modes", () => {
    expect(stripeMode(undefined)).toBe("unconfigured");
    expect(stripeMode("sk_test_1")).toBe("test");
    expect(stripeMode("sk_live_1")).toBe("live");
  });
  it("refuses live keys by default", () => {
    expect(() => assertUsableStripeKey(env({ STRIPE_SECRET_KEY: "sk_live_1" }))).toThrow(StripeLiveKeyRefusedError);
    expect(() =>
      assertUsableStripeKey(env({ STRIPE_SECRET_KEY: "sk_live_1", ALLOW_LIVE_STRIPE: "true", NODE_ENV: "development" })),
    ).toThrow(StripeLiveKeyRefusedError);
    expect(() =>
      assertUsableStripeKey(env({ STRIPE_SECRET_KEY: "sk_live_1", NODE_ENV: "production" })),
    ).toThrow(StripeLiveKeyRefusedError);
  });
  it("allows live only with both ALLOW_LIVE_STRIPE=true and NODE_ENV=production", () => {
    expect(
      assertUsableStripeKey(env({ STRIPE_SECRET_KEY: "sk_live_1", ALLOW_LIVE_STRIPE: "true", NODE_ENV: "production" })),
    ).toBe("sk_live_1");
  });
  it("throws not-configured without a key", () => {
    expect(() => assertUsableStripeKey(env({}))).toThrow(StripeNotConfiguredError);
  });
  it("allows test keys", () => {
    expect(assertUsableStripeKey(env({ STRIPE_SECRET_KEY: "sk_test_1" }))).toBe("sk_test_1");
  });
});
