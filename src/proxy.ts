import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

/**
 * Neon Auth session handling, scoped narrowly:
 *  - `/account/*` requires a session (redirects to /sign-in?next=…).
 *  - `/auth/callback` completes the OAuth (Google/Apple) verifier exchange.
 * The middleware also refreshes the short-lived session cache cookie.
 * Everything else (landing, /studio, pricing, legal) never runs this proxy.
 * Route handlers enforce auth themselves with `requireUser()`.
 */
export async function proxy(request: NextRequest) {
  const auth = getAuth();
  if (!auth) return NextResponse.next(); // pages render "not configured"
  const res = await auth.middleware({ loginUrl: "/sign-in" })(request);

  // Preserve where the user was going so sign-in can send them back.
  const location = res.headers.get("location");
  if (location && res.status >= 300 && res.status < 400) {
    const target = new URL(location, request.url);
    if (target.origin === request.nextUrl.origin && target.pathname === "/sign-in" && !target.searchParams.has("next")) {
      target.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      const redirect = NextResponse.redirect(target, res.status);
      for (const c of res.headers.getSetCookie()) redirect.headers.append("Set-Cookie", c);
      return redirect;
    }
  }
  return res;
}

export const config = {
  matcher: ["/account/:path*", "/auth/callback"],
};
