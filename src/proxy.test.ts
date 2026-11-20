import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mw = vi.hoisted(() => ({ impl: null as null | ((r: Request) => Response) }));
vi.mock("@/lib/auth/server", () => ({
  getAuth: () => ({ middleware: () => async (r: Request) => mw.impl!(r) }),
}));

import { proxy } from "./proxy";

describe("proxy", () => {
  it("adds ?next= to the sign-in redirect and keeps cookies", async () => {
    mw.impl = () => {
      const r = NextResponse.redirect("https://app.test/sign-in", 307);
      r.headers.append("Set-Cookie", "__Secure-neon-auth.local.session_data=; Max-Age=0; Path=/");
      return r;
    };
    const res = await proxy(new NextRequest("https://app.test/account/library?x=1"));
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/sign-in");
    expect(loc.searchParams.get("next")).toBe("/account/library?x=1");
    expect(res.headers.getSetCookie()).toHaveLength(1);
  });

  it("passes through allowed requests", async () => {
    mw.impl = () => NextResponse.next();
    const res = await proxy(new NextRequest("https://app.test/account"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("leaves non-sign-in redirects alone (OAuth exchange)", async () => {
    mw.impl = () => NextResponse.redirect("https://app.test/studio", 307);
    const res = await proxy(new NextRequest("https://app.test/auth/callback?neon_auth_session_verifier=x"));
    expect(res.headers.get("location")).toBe("https://app.test/studio");
  });
});
