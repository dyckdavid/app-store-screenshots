/** Pure session-user helpers (no server imports; unit-testable). */

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
}

export function toSessionUser(user: unknown): SessionUser | null {
  if (!user || typeof user !== "object") return null;
  const u = user as { id?: unknown; email?: unknown; name?: unknown };
  if (typeof u.id !== "string" && typeof u.id !== "number") return null;
  return {
    id: String(u.id),
    email: typeof u.email === "string" ? u.email : null,
    name: typeof u.name === "string" && u.name.trim() ? u.name : null,
  };
}
