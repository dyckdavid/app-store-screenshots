import { signOutServer } from "@/lib/auth/server";
import { isSameOrigin } from "@/lib/auth/origin-check";

export const dynamic = "force-dynamic";

/**
 * POST { everywhere?: boolean } — revoke the session(s) upstream and clear
 * all Neon Auth cookies. Route Handler, so cookie writes always work.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Bad origin" }, { status: 403 });
  }
  let everywhere = false;
  try {
    const body = (await request.json()) as { everywhere?: unknown };
    everywhere = body?.everywhere === true;
  } catch {
    // empty body is fine
  }
  await signOutServer({ everywhere });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
