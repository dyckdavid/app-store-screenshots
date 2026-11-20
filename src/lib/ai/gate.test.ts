import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: null as null | { id: string; email: string; name: null } }));

vi.mock("@/lib/auth/server", () => ({
  requireUser: async () =>
    auth.user
      ? { ok: true, user: auth.user }
      : {
          ok: false,
          response: Response.json({ error: "Sign in", code: "unauthenticated" }, { status: 401 }),
        },
}));
vi.mock("@/db/client", () => ({ isDbConfigured: () => true }));
vi.mock("@/lib/billing/quota", () => ({
  consumeQuota: async () => ({
    ok: false,
    snapshot: { plan: "free", used: 3, limit: 3, credits: 0, period: "day", resetsAt: "x" },
  }),
  quotaExceededBody: () => ({ code: "quota_exceeded" }),
}));
vi.mock("./config", async (orig) => ({
  ...(await orig<typeof import("./config")>()),
  isAiConfigured: () => true,
}));

import { gateAiRequest } from "./gate";
import { resetRateLimitStoreForTests } from "./rate-limit";

const req = () => new Request("http://x/api/ai/copy", { method: "POST", headers: { "x-forwarded-for": "1.2.3.4" } });

beforeEach(() => {
  auth.user = null;
  resetRateLimitStoreForTests();
});

describe("gateAiRequest", () => {
  it("returns 401 when signed out", async () => {
    const r = await gateAiRequest(req(), "copy");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("returns 402 quota_exceeded when over quota", async () => {
    auth.user = { id: "u1", email: "a@b.c", name: null };
    const r = await gateAiRequest(req(), "copy");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(402);
      expect(await r.response.json()).toMatchObject({ code: "quota_exceeded" });
    }
  });
});
