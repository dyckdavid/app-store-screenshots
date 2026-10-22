import { isAiConfigured } from "@/lib/ai/config";
import {
  clientIpFromRequest,
  consumeRateLimit,
} from "@/lib/ai/rate-limit";
import { AiServiceError, runAnalyzeScreenshot } from "@/lib/ai/service";

export const dynamic = "force-dynamic";
/** Vision calls can be slow; keep under Vercel Fluid Compute limits. */
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!isAiConfigured()) {
    return Response.json(
      {
        error:
          "AI features are disabled. Set AI_GATEWAY_API_KEY (or OIDC on Vercel) or XAI_API_KEY.",
      },
      { status: 503 },
    );
  }

  const limited = consumeRateLimit(clientIpFromRequest(request));
  if (!limited.ok) {
    return Response.json(
      { error: limited.error },
      {
        status: limited.status,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      },
    );
  }

  let body: { imageDataUrl?: unknown };
  try {
    body = (await request.json()) as { imageDataUrl?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const imageDataUrl =
    typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
  if (!imageDataUrl) {
    return Response.json(
      { error: "imageDataUrl is required." },
      { status: 400 },
    );
  }

  try {
    const result = await runAnalyzeScreenshot({ imageDataUrl });
    return Response.json({
      ...result,
      remaining: limited.remaining,
    });
  } catch (err) {
    if (err instanceof AiServiceError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: "Unexpected vision analysis error." },
      { status: 500 },
    );
  }
}
