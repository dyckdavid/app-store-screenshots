import { gateAiRequest } from "@/lib/ai/gate";
import { AiServiceError, runAnalyzeScreenshot } from "@/lib/ai/service";

export const dynamic = "force-dynamic";
/** Vision calls can be slow; keep under Vercel Fluid Compute limits. */
export const maxDuration = 120;

export async function POST(request: Request) {
  const gate = await gateAiRequest(request, "analyze");
  if (!gate.ok) return gate.response;
  const limited = gate.limited;
  /** Any non-2xx after the gate gives the quota unit back. */
  const respond = async (body: unknown, init?: ResponseInit) => {
    if (init?.status && init.status >= 300) await gate.release();
    return Response.json(body, init);
  };

  let body: { imageDataUrl?: unknown };
  try {
    body = (await request.json()) as { imageDataUrl?: unknown };
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

  try {
    const result = await runAnalyzeScreenshot({ imageDataUrl });
    return respond({
      ...result,
      remaining: limited.remaining, quota: gate.quota,
    });
  } catch (err) {
    if (err instanceof AiServiceError) {
      return respond({ error: err.message }, { status: err.status });
    }
    return respond(
      { error: "Unexpected vision analysis error." },
      { status: 500 },
    );
  }
}
