import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

/**
 * Neon Auth session handling, scoped narrowly:
 *  - `/account/*` requires a session (redirects to /sign-in).
 *  - `/auth/callback` completes the OAuth (Google/Apple) verifier exchange.
 * Everything else (landing, /studio editor, pricing, legal) never runs this
 * proxy, so the anonymous editor is untouched. Route handlers additionally
 * enforce auth with `requireUser()`; this is only the optimistic check.
 */
export async function proxy(request: NextRequest) {
  const auth = getAuth();
  if (!auth) return NextResponse.next(); // pages render "not configured"
  const mw = auth.middleware({ loginUrl: "/sign-in" });
  return mw(request);
}

export const config = {
  matcher: ["/account/:path*", "/auth/callback"],
};
