import { afterEach, describe, expect, it } from "vitest";
import {
  consumeRateLimit,
  resetRateLimitStoreForTests,
} from "./rate-limit";

afterEach(() => {
  resetRateLimitStoreForTests();
  delete process.env.XAI_RATE_LIMIT_PER_IP_PER_MINUTE;
  delete process.env.XAI_RATE_LIMIT_PER_IP_PER_DAY;
  delete process.env.XAI_RATE_LIMIT_GLOBAL_PER_DAY;
});

describe("consumeRateLimit", () => {
  it("allows requests under the per-IP minute cap", () => {
    process.env.XAI_RATE_LIMIT_PER_IP_PER_MINUTE = "2";
    process.env.XAI_RATE_LIMIT_PER_IP_PER_DAY = "10";
    process.env.XAI_RATE_LIMIT_GLOBAL_PER_DAY = "100";

    expect(consumeRateLimit("1.1.1.1").ok).toBe(true);
    expect(consumeRateLimit("1.1.1.1").ok).toBe(true);
    const third = consumeRateLimit("1.1.1.1");
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.status).toBe(429);
  });

  it("tracks IPs independently", () => {
    process.env.XAI_RATE_LIMIT_PER_IP_PER_MINUTE = "1";
    process.env.XAI_RATE_LIMIT_PER_IP_PER_DAY = "10";
    process.env.XAI_RATE_LIMIT_GLOBAL_PER_DAY = "100";

    expect(consumeRateLimit("a").ok).toBe(true);
    expect(consumeRateLimit("b").ok).toBe(true);
    expect(consumeRateLimit("a").ok).toBe(false);
  });
});
