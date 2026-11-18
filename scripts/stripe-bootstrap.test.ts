import { describe, expect, it } from "vitest";
import { assertTestModeKey } from "./stripe-bootstrap";

describe("stripe:bootstrap key guard", () => {
  it("refuses live keys", () => {
    expect(() => assertTestModeKey("sk_live_abc")).toThrow(/LIVE/);
    expect(() => assertTestModeKey("rk_live_abc")).toThrow(/LIVE/);
  });
  it("refuses missing or unknown keys", () => {
    expect(() => assertTestModeKey(undefined)).toThrow();
    expect(() => assertTestModeKey("pk_test_abc")).toThrow();
  });
  it("accepts test keys", () => {
    expect(assertTestModeKey("sk_test_abc")).toBe("sk_test_abc");
  });
});
