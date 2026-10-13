import { getRateLimitConfig, isAiConfigured } from "@/lib/ai/config";
import {
  clientIpFromRequest,
  consumeRateLimit,
} from "@/lib/ai/rate-limit";
import { generateImagineImage, XaiHttpError } from "@/lib/ai/xai";
import type { AiGeneratePurpose } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAiConfigured()) {
    return Response.json(
      {
        error:
          "AI features are disabled. Set XAI_API_KEY on the server to enable.",
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

  let body: { prompt?: unknown; purpose?: unknown };
  try {
    body = (await request.json()) as { prompt?: unknown; purpose?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const caps = getRateLimitConfig();
  const prompt =
    typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return Response.json({ error: "prompt is required." }, { status: 400 });
  }
  if (prompt.length > caps.maxPromptLength) {
    return Response.json(
      {
        error: `prompt exceeds max length (${caps.maxPromptLength} characters).`,
      },
      { status: 400 },
    );
  }

  const purpose: AiGeneratePurpose =
    body.purpose === "graphic" ? "graphic" : "background";

  try {
    const result = await generateImagineImage({ prompt, purpose });
    return Response.json({
      ...result,
      remaining: limited.remaining,
    });
  } catch (err) {
    if (err instanceof XaiHttpError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: "Unexpected image generation error." },
      { status: 500 },
    );
  }
}
