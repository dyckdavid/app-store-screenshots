import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  requireUser: async () => ({
    ok: false,
    response: Response.json({ error: "Sign in", code: "unauthenticated" }, { status: 401 }),
  }),
}));

import { POST } from "./route";

describe("POST /api/billing/checkout", () => {
  it("returns 401 when signed out", async () => {
    const res = await POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ priceKey: "asc_pro_monthly" }),
      }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "unauthenticated" });
  });
});
