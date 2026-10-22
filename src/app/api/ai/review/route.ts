import { isAiConfigured } from "@/lib/ai/config";
import {
  clientIpFromRequest,
  consumeRateLimit,
} from "@/lib/ai/rate-limit";
import { AiServiceError, runReviewOutput } from "@/lib/ai/service";
import type { DeviceLayout } from "@/lib/design";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LAYOUTS: DeviceLayout[] = [
  "single",
  "dual-side",
  "dual-overlap",
  "dual-angled",
  "foldable-closed",
  "foldable-open",
];

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

  let body: {
    imageDataUrl?: unknown;
    headline?: unknown;
    subtitle?: unknown;
    layout?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
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

  const layout =
    typeof body.layout === "string" &&
    LAYOUTS.includes(body.layout as DeviceLayout)
      ? (body.layout as DeviceLayout)
      : undefined;

  try {
    const result = await runReviewOutput({
      imageDataUrl,
      headline: typeof body.headline === "string" ? body.headline : undefined,
      subtitle: typeof body.subtitle === "string" ? body.subtitle : undefined,
      layout,
    });
    return Response.json({ ...result, remaining: limited.remaining });
  } catch (err) {
    if (err instanceof AiServiceError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: "Unexpected review error." },
      { status: 500 },
    );
  }
}
