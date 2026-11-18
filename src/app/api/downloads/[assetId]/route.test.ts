import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; name: null },
  entitled: false,
  downloads: 0,
}));

vi.mock("@/lib/auth/server", () => ({
  requireUser: async () =>
    state.user
      ? { ok: true, user: state.user }
      : { ok: false, response: Response.json({ code: "unauthenticated" }, { status: 401 }) },
}));
vi.mock("@/db/client", () => ({ isDbConfigured: () => true }));
vi.mock("@/lib/billing/entitlements", () => ({ hasEntitlement: async () => state.entitled }));
vi.mock("@/lib/billing/repo", () => ({
  getAsset: async (id: number) =>
    id === 1
      ? { id: 1, productKey: "sample_plan_pdf", filename: "sample plan.pdf", storageKey: "k", sizeBytes: 3, version: 1 }
      : null,
  recordDownload: async () => {
    state.downloads++;
  },
}));
vi.mock("@/lib/storage", () => ({
  StorageNotConfiguredError: class extends Error {},
  getStorage: () => ({
    get: async () => ({
      stream: new Response("pdf").body,
      contentType: "application/pdf",
      size: 3,
    }),
  }),
}));

import { GET } from "./route";

const call = (id: string) =>
  GET(new Request(`http://x/api/downloads/${id}`), { params: Promise.resolve({ assetId: id }) });

beforeEach(() => {
  state.user = null;
  state.entitled = false;
  state.downloads = 0;
});

describe("GET /api/downloads/[assetId]", () => {
  it("401 when signed out", async () => {
    expect((await call("1")).status).toBe(401);
  });
  it("404 for unknown assets", async () => {
    state.user = { id: "u", email: "e", name: null };
    expect((await call("999")).status).toBe(404);
    expect((await call("abc")).status).toBe(404);
  });
  it("403 without entitlement, and no download logged", async () => {
    state.user = { id: "u", email: "e", name: null };
    expect((await call("1")).status).toBe(403);
    expect(state.downloads).toBe(0);
  });
  it("streams with attachment headers and logs the download", async () => {
    state.user = { id: "u", email: "e", name: null };
    state.entitled = true;
    const res = await call("1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="sample_plan.pdf"');
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.text()).toBe("pdf");
    expect(state.downloads).toBe(1);
  });
});
