/** Pure config checks for Neon Auth (safe to import anywhere). */

export function isAuthConfigured(): boolean {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET ?? "";
  return Boolean(process.env.NEON_AUTH_BASE_URL) && secret.length >= 32;
}

/** Sign in with Apple is opt-in: needs Console config + this flag. */
export function isAppleSignInEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_APPLE_ENABLED === "true";
}

/** Only allow same-origin relative redirect targets (no `//host`). */
export function safeNextPath(next: string | null | undefined, fallback = "/account"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
