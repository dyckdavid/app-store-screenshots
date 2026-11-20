import { gateAiRequest } from "@/lib/ai/gate";
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
  const gate = await gateAiRequest(request, "review");
  if (!gate.ok) return gate.response;
  const limited = gate.limited;
  /** Any non-2xx after the gate gives the quota unit back. */
  const respond = async (body: unknown, init?: ResponseInit) => {
    if (init?.status && init.status >= 300) await gate.release();
    return Response.json(body, init);
  };

  let body: {
    imageDataUrl?: unknown;
    headline?: unknown;
    subtitle?: unknown;
    layout?: unknown;
  };
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
    return respond({ ...result, remaining: limited.remaining, quota: gate.quota });
  } catch (err) {
    if (err instanceof AiServiceError) {
      return respond({ error: err.message }, { status: err.status });
    }
    return respond(
      { error: "Unexpected review error." },
      { status: 500 },
    );
  }
}
