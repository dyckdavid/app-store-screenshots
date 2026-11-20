import { gateAiRequest } from "@/lib/ai/gate";
import { AiServiceError, runPickLayout } from "@/lib/ai/service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const gate = await gateAiRequest(request, "layout");
  if (!gate.ok) return gate.response;
  const limited = gate.limited;
  /** Any non-2xx after the gate gives the quota unit back. */
  const respond = async (body: unknown, init?: ResponseInit) => {
    if (init?.status && init.status >= 300) await gate.release();
    return Response.json(body, init);
  };

  let body: { imageDataUrl?: unknown; screenshotCount?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return respond({ error: "Invalid JSON body." }, { status: 400 });
  }

  const imageDataUrl =
    typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
  if (!imageDataUrl) {
    return respond(
      { error: "imageDataUrl is required." },
      { status: 400 },
    );
  }

  const screenshotCount =
    typeof body.screenshotCount === "number" &&
    Number.isFinite(body.screenshotCount)
      ? Math.max(1, Math.floor(body.screenshotCount))
      : 1;

  try {
    const result = await runPickLayout({ imageDataUrl, screenshotCount });
    return respond({ ...result, remaining: limited.remaining, quota: gate.quota });
  } catch (err) {
    if (err instanceof AiServiceError) {
      return respond({ error: err.message }, { status: err.status });
    }
    return respond(
      { error: "Unexpected layout pick error." },
      { status: 500 },
    );
  }
}
