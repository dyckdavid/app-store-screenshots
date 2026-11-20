import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./errors";
import { isSameOrigin } from "./origin-check";
import { safePath } from "./session-client";
import { safeNextPath } from "./config";
import { toSessionUser } from "./user";


describe("authErrorMessage", () => {
  it("maps Better Auth codes to friendly text", () => {
    expect(authErrorMessage({ code: "INVALID_OTP" }, "x")).toMatch(/code isn't right/);
    expect(authErrorMessage({ code: "OTP_EXPIRED" }, "x")).toMatch(/expired/);
    expect(authErrorMessage({ status: 429 }, "x")).toMatch(/Too many/);
    expect(authErrorMessage({ status: 403 }, "x")).toMatch(/trusted/);
  });
  it("falls back for unknown / huge errors", () => {
    expect(authErrorMessage(null, "fallback")).toBe("fallback");
    expect(authErrorMessage({ message: "x".repeat(500) }, "fallback")).toBe("fallback");
    expect(authErrorMessage({ message: "Short reason" }, "fallback")).toBe("Short reason");
  });
});

describe("redirect target safety", () => {
  it.each([
    ["/studio", "/studio"],
    ["/account?checkout=success", "/account?checkout=success"],
    ["//evil.com", "/fallback"],
    ["/\\evil.com", "/fallback"],
    ["https://evil.com", "/fallback"],
    ["", "/fallback"],
    [null, "/fallback"],
  ])("%s → %s", (input, expected) => {
    expect(safePath(input as string | null, "/fallback")).toBe(expected);
    expect(safeNextPath(input as string | null, "/fallback")).toBe(expected);
  });
});

describe("isSameOrigin", () => {
  const req = (origin: string | null, host = "app.example.com") =>
    new Request(`https://${host}/api/account/sign-out`, {
      method: "POST",
      headers: { host, ...(origin ? { origin } : {}) },
    });
  it("accepts same origin and missing origin", () => {
    expect(isSameOrigin(req("https://app.example.com"))).toBe(true);
    expect(isSameOrigin(req(null))).toBe(true);
  });
  it("rejects cross-site and garbage origins", () => {
    expect(isSameOrigin(req("https://evil.com"))).toBe(false);
    expect(isSameOrigin(req("not a url"))).toBe(false);
  });
});

describe("toSessionUser", () => {
  it("normalizes upstream user objects", () => {
    expect(toSessionUser({ id: "u1", email: "a@b.c", name: "  " })).toEqual({ id: "u1", email: "a@b.c", name: null });
    expect(toSessionUser({ id: 42, email: null })).toEqual({ id: "42", email: null, name: null });
    expect(toSessionUser({ email: "no-id@x.y" })).toBeNull();
    expect(toSessionUser(null)).toBeNull();
  });
});
