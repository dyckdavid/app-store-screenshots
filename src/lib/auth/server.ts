import "server-only";
import { createNeonAuth, type NeonAuth } from "@neon/auth/next/server";
import { isAuthConfigured } from "./config";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
}

let cached: NeonAuth | null = null;

/**
 * Lazy Neon Auth instance. Returns null when NEON_AUTH_* env is missing so
 * builds and anonymous pages keep working ("not configured" state).
 */
export function getAuth(): NeonAuth | null {
  if (!isAuthConfigured()) return null;
  if (!cached) {
    cached = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL!,
      cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
    });
  }
  return cached;
}

/** Current signed-in user, or null (also null when auth isn't configured). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const auth = getAuth();
  if (!auth) return null;
  try {
    const { data } = await auth.getSession();
    const user = data?.user;
    if (!user?.id) return null;
    return {
      id: String(user.id),
      email: user.email ?? null,
      name: user.name ?? null,
    };
  } catch {
    return null;
  }
}

export type RequireUserResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: Response };

/** For route handlers: 401 JSON the UI can render when signed out. */
export async function requireUser(): Promise<RequireUserResult> {
  if (!isAuthConfigured()) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "Accounts are not configured on this deployment.",
          code: "auth_not_configured",
        },
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

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
