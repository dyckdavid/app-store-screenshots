import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ signOut: [] as { everywhere?: boolean }[] }));
vi.mock("@/lib/auth/server", () => ({
  signOutServer: async (opts: { everywhere?: boolean }) => {
    calls.signOut.push(opts);
  },
}));

import { POST } from "./route";

const req = (body: unknown, origin = "https://app.test") =>
  new Request("https://app.test/api/account/sign-out", {
    method: "POST",
    headers: { origin, host: "app.test", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  calls.signOut = [];
});

describe("POST /api/account/sign-out", () => {
  it("signs out this device", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(calls.signOut).toEqual([{ everywhere: false }]);
  });
  it("signs out everywhere when asked", async () => {
    await POST(req({ everywhere: true }));
    expect(calls.signOut).toEqual([{ everywhere: true }]);
  });
  it("tolerates an empty body", async () => {
    expect((await POST(req(undefined))).status).toBe(200);
  });
  it("rejects cross-site requests (logout CSRF)", async () => {
    const res = await POST(req({}, "https://evil.com"));
    expect(res.status).toBe(403);
    expect(calls.signOut).toHaveLength(0);
  });
});
