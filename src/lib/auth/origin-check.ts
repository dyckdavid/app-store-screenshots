/**
 * Minimal CSRF guard for state-changing POSTs that rely on cookies:
 * the browser always sends Origin on cross-site POSTs, so reject a
 * mismatching one. (Requests without Origin, e.g. curl, carry no cookies
 * from a victim's browser.)
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
