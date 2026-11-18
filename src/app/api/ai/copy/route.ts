import { gateAiRequest } from "@/lib/ai/gate";
import { AiServiceError, runGenerateCopy } from "@/lib/ai/service";
import type { CopyLocale } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ALLOWED: CopyLocale[] = [
  "en",
  "es",
  "de",
  "fr",
  "pt",
  "ja",
  "zh-Hans",
  "ko",
];

export async function POST(request: Request) {
  const gate = await gateAiRequest(request, "copy");
  if (!gate.ok) return gate.response;
  const limited = gate.limited;
  /** Any non-2xx after the gate gives the quota unit back. */
  const respond = async (body: unknown, init?: ResponseInit) => {
    if (init?.status && init.status >= 300) await gate.release();
    return Response.json(body, init);
  };

  let body: {
    imageDataUrl?: unknown;
    contextHeadline?: unknown;
    contextSubtitle?: unknown;
    locales?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return respond({ error: "Invalid JSON body." }, { status: 400 });
  }

  const localesRaw = Array.isArray(body.locales) ? body.locales : ["en", "es"];
  const locales = localesRaw.filter(
    (l): l is CopyLocale =>
      typeof l === "string" && (ALLOWED as string[]).includes(l),
  );

  try {
    const result = await runGenerateCopy({
      imageDataUrl:
        typeof body.imageDataUrl === "string" ? body.imageDataUrl : undefined,
      contextHeadline:
        typeof body.contextHeadline === "string"
          ? body.contextHeadline
          : undefined,
      contextSubtitle:
        typeof body.contextSubtitle === "string"
          ? body.contextSubtitle
          : undefined,
      locales: locales.length ? locales : ["en", "es"],
    });
    return respond({ ...result, remaining: limited.remaining, quota: gate.quota });
  } catch (err) {
    if (err instanceof AiServiceError) {
      return respond({ error: err.message }, { status: err.status });
    }
    return respond(
      { error: "Unexpected copy generation error." },
      { status: 500 },
    );
  }
}
