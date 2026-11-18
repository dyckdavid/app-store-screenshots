import { getAuth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type Handler = (
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) => Promise<Response>;

function notConfigured(): Response {
  return Response.json(
    {
      error:
        "Neon Auth is not configured. Set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET.",
      code: "auth_not_configured",
    },
    { status: 503 },
  );
}

function forward(method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"): Handler {
  return async (request, ctx) => {
    const auth = getAuth();
    if (!auth) return notConfigured();
    const handlers = auth.handler() as unknown as Record<string, Handler>;
    const fn = handlers[method];
    if (!fn) return new Response(null, { status: 405 });
    return fn(request, ctx);
  };
}

export const GET = forward("GET");
export const POST = forward("POST");
export const PUT = forward("PUT");
export const DELETE = forward("DELETE");
export const PATCH = forward("PATCH");
