import { isAiConfigured } from "@/lib/ai/config";
import {
  clientIpFromRequest,
  consumeRateLimit,
} from "@/lib/ai/rate-limit";
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
    contextHeadline?: unknown;
    contextSubtitle?: unknown;
    locales?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
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
    return Response.json({ ...result, remaining: limited.remaining });
  } catch (err) {
    if (err instanceof AiServiceError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: "Unexpected copy generation error." },
      { status: 500 },
    );
  }
}
