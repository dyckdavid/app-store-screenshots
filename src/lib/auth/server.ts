import "server-only";
/**
 * Server-side auth. Two Neon Auth instances, both lazy (null when env is
 * missing, so builds and anonymous pages keep working):
 *
 *  - `getAuth()` — Next adapter (`createNeonAuth`) used ONLY for the
 *    `/api/auth/*` proxy handler and the `proxy.ts` middleware, which work
 *    on the raw Request/Response.
 *  - `serverApi()` — `createAuthServer` with our own request context whose
 *    `setCookie` is best-effort. Next only allows cookie writes in Route
 *    Handlers and Server Actions; the stock adapter throws inside Server
 *    Components whenever Neon refreshes a cookie, which made signed-in users
 *    look signed out. Here the write is attempted and silently skipped where
 *    it isn't allowed (the next route handler / proxy run persists it).
 */
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createNeonAuth, type NeonAuth } from "@neon/auth/next/server";
import { createAuthServer, extractNeonAuthCookies, type NeonAuthServer } from "@neon/auth/server";
import { isAuthConfigured } from "./config";
import { toSessionUser, type SessionUser } from "./user";

export { toSessionUser, type SessionUser };

let nextAuth: NeonAuth | null = null;
let api: NeonAuthServer | null = null;

function config() {
  return {
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  };
}

/** Next adapter: route handler + middleware only. */
export function getAuth(): NeonAuth | null {
  if (!isAuthConfigured()) return null;
  if (!nextAuth) {
    const { baseUrl, secret } = config();
    nextAuth = createNeonAuth({ baseUrl, cookies: { secret } });
  }
  return nextAuth;
}

/** Server API usable from Server Components, Route Handlers, and Actions. */
export function serverApi(): NeonAuthServer | null {
  if (!isAuthConfigured()) return null;
  if (!api) {
    const { baseUrl, secret } = config();
    api = createAuthServer({
      baseUrl,
      cookieSecret: secret,
      context: async () => {
        const cookieStore = await cookies();
        const headerStore = await headers();
        return {
          getCookies: () => extractNeonAuthCookies(headerStore),
          setCookie: (name, value, options) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Server Component render: cookies are read-only. Safe to skip.
            }
          },
          getHeader: (name) => headerStore.get(name),
          getOrigin: () => {
            const origin = headerStore.get("origin");
            if (origin) return origin;
            const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
            const proto = headerStore.get("x-forwarded-proto") ?? "https";
            return host ? `${proto}://${host}` : "";
          },
          getFramework: () => "nextjs",
        };
      },
    });
  }
  return api;
}

/**
 * Current signed-in user, or null. Deduplicated per request (React cache),
 * so pages, layouts, and helpers can all call it freely.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const auth = serverApi();
  if (!auth) return null;
  try {
    const { data } = await auth.getSession();
    return toSessionUser((data as { user?: unknown } | null)?.user);
  } catch (err) {
    console.warn("[auth] getSession failed", err instanceof Error ? err.message : err);
    return null;
  }
});

export type RequireUserResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: Response };

/** For route handlers: 401 JSON the UI can render when signed out. */
export async function requireUser(): Promise<RequireUserResult> {
  if (!isAuthConfigured()) {
    return {
      ok: false,
      response: Response.json(
        { error: "Accounts are not configured on this deployment.", code: "auth_not_configured" },
        { status: 503 },
      ),
    };
  }
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json(
        { error: "Sign in to use this feature.", code: "unauthenticated" },
        { status: 401 },
      ),
    };
  }
  return { ok: true, user };
}

/**
 * Sign out on the server: revokes the session upstream and clears both the
 * session token and the cached session-data cookie. Must run in a Route
 * Handler or Server Action (where cookies are writable).
 */
export async function signOutServer(opts: { everywhere?: boolean } = {}): Promise<void> {
  const auth = serverApi();
  if (!auth) return;
  if (opts.everywhere) {
    try {
      await auth.revokeOtherSessions();
    } catch {
      // still sign out this device
    }
  }
  try {
    await auth.signOut();
  } catch {
    // fall through: we still clear cookies locally below
  }
  // Belt and braces: expire every Neon Auth cookie we can see, so a failed
  // upstream call can never leave the browser "half signed in".
  const store = await cookies();
  for (const c of store.getAll()) {
    if (c.name.startsWith("__Secure-neon-auth")) {
      store.set(c.name, "", { path: "/", maxAge: 0, secure: true, httpOnly: true, sameSite: "lax" });
    }
  }
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
