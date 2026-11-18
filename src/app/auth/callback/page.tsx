import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

/**
 * OAuth landing page. `src/proxy.ts` runs the Neon Auth middleware on this
 * path, which exchanges the session verifier for a session cookie; then we
 * forward to the (same-origin only) `next` target.
 */
export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(safeNextPath(next));
}
