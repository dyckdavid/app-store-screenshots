import { getRateLimitConfig } from "@/lib/ai/config";
import { gateAiRequest } from "@/lib/ai/gate";
import { AiServiceError, runGenerateImage } from "@/lib/ai/service";
import type { AiGeneratePurpose } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const gate = await gateAiRequest(request, "generate-image");
  if (!gate.ok) return gate.response;
  const limited = gate.limited;
  /** Any non-2xx after the gate gives the quota unit back. */
  const respond = async (body: unknown, init?: ResponseInit) => {
    if (init?.status && init.status >= 300) await gate.release();
    return Response.json(body, init);
  };

  let body: { prompt?: unknown; purpose?: unknown };
  try {
    body = (await request.json()) as { prompt?: unknown; purpose?: unknown };
  } catch {
    return respond({ error: "Invalid JSON body." }, { status: 400 });
  }

  const caps = getRateLimitConfig();
  const prompt =
    typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return respond({ error: "prompt is required." }, { status: 400 });
  }
  if (prompt.length > caps.maxPromptLength) {
    return respond(
      {
        error: `prompt exceeds max length (${caps.maxPromptLength} characters).`,
      },
      { status: 400 },
    );
  }

  const purpose: AiGeneratePurpose =
    body.purpose === "graphic" ? "graphic" : "background";

  try {
    const result = await runGenerateImage({ prompt, purpose });
    return respond({
      ...result,
      remaining: limited.remaining, quota: gate.quota,
    });
  } catch (err) {
    if (err instanceof AiServiceError) {
      return respond({ error: err.message }, { status: err.status });
    }
    return respond(
      { error: "Unexpected image generation error." },
      { status: 500 },
    );
  }
}
