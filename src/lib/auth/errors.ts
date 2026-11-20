/** Human messages for Better Auth error codes / statuses. */
export function authErrorMessage(err: unknown, fallback: string): string {
  const e = (err ?? {}) as { code?: string; status?: number; message?: string };
  const code = (e.code ?? "").toUpperCase();
  if (code.includes("INVALID_OTP") || code.includes("INVALID_CODE")) return "That code isn't right. Check the latest email and try again.";
  if (code.includes("OTP_EXPIRED") || code.includes("EXPIRED")) return "That code expired. Send a new one.";
  if (code.includes("TOO_MANY") || e.status === 429) return "Too many attempts. Wait a minute and try again.";
  if (code.includes("INVALID_EMAIL")) return "That email address doesn't look right.";
  if (e.status === 403) return "Sign-in isn't allowed from this site yet (the domain must be trusted in Neon Auth).";
  if (typeof e.message === "string" && e.message && e.message.length < 140) return e.message;
  return fallback;
}
