import { generateImage, generateText, Output } from "ai";
import {
  GATEWAY_COPY_MODEL,
  GATEWAY_IMAGE_MODEL,
  GATEWAY_VISION_MODEL,
  getRateLimitConfig,
  isGatewayConfigured,
} from "./config";
import {
  localizedCopySchema,
  layoutPickSchema,
  reviewSchema,
  suggestionsSchema,
} from "./schemas";
import type {
  AiGeneratePurpose,
  CopyLocale,
  CopySuggestionsResponse,
  LocalizedCopy,
  ReviewScorecard,
  ScreenshotAiSuggestions,
} from "./types";
import type { DeviceLayout } from "@/lib/design";
import { normalizeSuggestions } from "./normalize";

export class AiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function assertGateway() {
  if (!isGatewayConfigured()) {
    throw new AiHttpError(
      503,
      "AI Gateway is not configured. Set AI_GATEWAY_API_KEY or deploy with Vercel OIDC.",
    );
  }
}

function purposePrefix(purpose: AiGeneratePurpose): string {
  if (purpose === "background") {
    return "App Store marketing screenshot BACKGROUND only. Abstract atmospheric backdrop, soft shapes, no text, no phones, no UI chrome, no logos. Full-bleed composition suitable behind a device frame. ";
  }
  return "App Store marketing DECORATIVE GRAPHIC LAYER on transparent-friendly solid color field if needed: single motif, sticker-like or floating accent (glow orb, soft ribbon, geometric flourish). No text, no device mockups, no logos. ";
}

export async function gatewayGenerateImage(options: {
  prompt: string;
  purpose: AiGeneratePurpose;
}): Promise<{ dataUrl: string; mimeType: string; model: string }> {
  assertGateway();
  const caps = getRateLimitConfig();
  const prompt = options.prompt.trim().slice(0, caps.maxPromptLength);
  if (!prompt) throw new AiHttpError(400, "Prompt is required.");

  const fullPrompt = `${purposePrefix(options.purpose)}${prompt}`;

  try {
    const { image } = await generateImage({
      model: GATEWAY_IMAGE_MODEL,
      prompt: fullPrompt,
      aspectRatio: options.purpose === "background" ? "9:16" : "1:1",
      n: 1,
    });
    const mimeType = "image/png";
    return {
      dataUrl: `data:${mimeType};base64,${image.base64}`,
      mimeType,
      model: GATEWAY_IMAGE_MODEL,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Image generation failed.";
    throw new AiHttpError(502, message);
  }
}

export async function gatewayAnalyzeScreenshot(options: {
  imageDataUrl: string;
}): Promise<{ suggestions: ScreenshotAiSuggestions; model: string }> {
  assertGateway();
  const caps = getRateLimitConfig();
  validateVisionPayload(options.imageDataUrl, caps.visionMaxBase64Chars);

  try {
    const { output } = await generateText({
      model: GATEWAY_VISION_MODEL,
      temperature: 0.2,
      maxOutputTokens: 600,
      output: Output.object({ schema: suggestionsSchema }),
      messages: [
        {
          role: "system",
          content:
            "You analyze App Store screenshots for marketing styling. Prefer dual layouts when two complementary UI states are visible; prefer foldable-open only when the UI benefits from a wide foldable canvas.",
        },
        {
          role: "user",
          content: [
            { type: "image", image: options.imageDataUrl },
            {
              type: "text",
              text: "Suggest App Store marketing headline, subtitle, device layout, background, and palette for this screenshot.",
            },
          ],
        },
      ],
    });

    if (!output) {
      throw new AiHttpError(502, "Vision model returned no structured output.");
    }
    return {
      suggestions: normalizeSuggestions(output),
      model: GATEWAY_VISION_MODEL,
    };
  } catch (err) {
    if (err instanceof AiHttpError) throw err;
    const message =
      err instanceof Error ? err.message : "Vision analysis failed.";
    throw new AiHttpError(502, message);
  }
}

const LOCALE_LABELS: Record<CopyLocale, string> = {
  en: "English",
  es: "Spanish",
  de: "German",
  fr: "French",
  pt: "Portuguese",
  ja: "Japanese",
  "zh-Hans": "Chinese (Simplified)",
  ko: "Korean",
};

export async function gatewayGenerateCopy(options: {
  imageDataUrl?: string;
  contextHeadline?: string;
  contextSubtitle?: string;
  locales: CopyLocale[];
}): Promise<CopySuggestionsResponse> {
  assertGateway();
  const locales =
    options.locales.length > 0
      ? options.locales
      : (["en", "es"] as CopyLocale[]);

  if (options.imageDataUrl) {
    const caps = getRateLimitConfig();
    validateVisionPayload(options.imageDataUrl, caps.visionMaxBase64Chars);
  }

  const localeList = locales
    .map((l) => `${l} (${LOCALE_LABELS[l]})`)
    .join(", ");

  const content: Array<
    { type: "text"; text: string } | { type: "image"; image: string }
  > = [];
  if (options.imageDataUrl) {
    content.push({ type: "image", image: options.imageDataUrl });
  }
  content.push({
    type: "text",
    text: [
      "Write short App Store screenshot marketing copy (headline ≤48 chars, subtitle ≤64 chars).",
      `Locales required: ${localeList}.`,
      options.contextHeadline
        ? `Current headline hint: ${options.contextHeadline}`
        : "",
      options.contextSubtitle
        ? `Current subtitle hint: ${options.contextSubtitle}`
        : "",
      "Keep tone premium and concrete. Spanish must be natural (not literal English).",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  try {
    const { output } = await generateText({
      model: GATEWAY_COPY_MODEL,
      temperature: 0.4,
      maxOutputTokens: 800,
      output: Output.object({ schema: localizedCopySchema }),
      messages: [
        {
          role: "system",
          content:
            "You write App Store screenshot captions. Return only the structured locales requested.",
        },
        { role: "user", content },
      ],
    });

    if (!output?.locales?.length) {
      throw new AiHttpError(502, "Copy model returned no locales.");
    }

    const normalized: LocalizedCopy[] = output.locales.map((row) => ({
      locale: row.locale,
      localeLabel: row.localeLabel || LOCALE_LABELS[row.locale] || row.locale,
      headline: row.headline.trim().slice(0, 48),
      subtitle: row.subtitle.trim().slice(0, 64),
    }));

    return { locales: normalized, model: GATEWAY_COPY_MODEL };
  } catch (err) {
    if (err instanceof AiHttpError) throw err;
    const message =
      err instanceof Error ? err.message : "Copy generation failed.";
    throw new AiHttpError(502, message);
  }
}

export async function gatewayPickLayout(options: {
  imageDataUrl: string;
  screenshotCount: number;
}): Promise<{
  layout: DeviceLayout;
  rationale: string;
  confidence: number;
  model: string;
}> {
  assertGateway();
  const caps = getRateLimitConfig();
  validateVisionPayload(options.imageDataUrl, caps.visionMaxBase64Chars);

  try {
    const { output } = await generateText({
      model: GATEWAY_VISION_MODEL,
      temperature: 0.2,
      maxOutputTokens: 300,
      output: Output.object({ schema: layoutPickSchema }),
      messages: [
        {
          role: "system",
          content:
            "Pick the best App Store device layout for this screenshot set. dual-* needs ≥2 shots; foldable-open suits wide/split UI; single is the safe default.",
        },
        {
          role: "user",
          content: [
            { type: "image", image: options.imageDataUrl },
            {
              type: "text",
              text: `Screenshot count in set: ${options.screenshotCount}. Choose layout.`,
            },
          ],
        },
      ],
    });

    if (!output) {
      throw new AiHttpError(502, "Layout model returned no output.");
    }

    let layout = output.layout as DeviceLayout;
    if (
      options.screenshotCount < 2 &&
      (layout === "dual-side" ||
        layout === "dual-overlap" ||
        layout === "dual-angled")
    ) {
      layout = "single";
    }

    return {
      layout,
      rationale: output.rationale,
      confidence: output.confidence,
      model: GATEWAY_VISION_MODEL,
    };
  } catch (err) {
    if (err instanceof AiHttpError) throw err;
    const message =
      err instanceof Error ? err.message : "Layout pick failed.";
    throw new AiHttpError(502, message);
  }
}

export async function gatewayReviewOutput(options: {
  imageDataUrl: string;
  headline?: string;
  subtitle?: string;
  layout?: DeviceLayout;
}): Promise<{ review: ReviewScorecard; model: string }> {
  assertGateway();
  const caps = getRateLimitConfig();
  validateVisionPayload(options.imageDataUrl, caps.visionMaxBase64Chars);

  try {
    const { output } = await generateText({
      model: GATEWAY_VISION_MODEL,
      temperature: 0.2,
      maxOutputTokens: 900,
      output: Output.object({ schema: reviewSchema }),
      messages: [
        {
          role: "system",
          content:
            "You are an App Store screenshot reviewer. Score 0–100 for readability, contrast, text size, guideline risk, and consistency. Provide concrete one-click fixes (color hex, sizes, inset, layout) when possible. Flag Apple guideline issues like unreadable text, low contrast, cluttered chrome, or misleading device framing.",
        },
        {
          role: "user",
          content: [
            { type: "image", image: options.imageDataUrl },
            {
              type: "text",
              text: [
                `Headline: ${options.headline || "(none)"}`,
                `Subtitle: ${options.subtitle || "(none)"}`,
                `Layout: ${options.layout || "single"}`,
                "Review this marketing composition.",
              ].join("\n"),
            },
          ],
        },
      ],
    });

    if (!output) {
      throw new AiHttpError(502, "Review model returned no output.");
    }

    return {
      review: {
        overall: clampScore(output.overall),
        readability: clampScore(output.readability),
        contrast: clampScore(output.contrast),
        textSize: clampScore(output.textSize),
        guidelines: clampScore(output.guidelines),
        consistency: clampScore(output.consistency),
        summary: output.summary.slice(0, 240),
        issues: output.issues.map((issue, i) => ({
          ...issue,
          id: issue.id || `issue-${i + 1}`,
        })),
      },
      model: GATEWAY_VISION_MODEL,
    };
  } catch (err) {
    if (err instanceof AiHttpError) throw err;
    const message = err instanceof Error ? err.message : "Review failed.";
    throw new AiHttpError(502, message);
  }
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function validateVisionPayload(dataUrl: string, maxChars: number) {
  if (!dataUrl.startsWith("data:image/")) {
    throw new AiHttpError(400, "Expected a data:image/...;base64,... payload.");
  }
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new AiHttpError(400, "Malformed image data URL.");
  const b64 = dataUrl.slice(comma + 1);
  if (b64.length > maxChars) {
    throw new AiHttpError(
      413,
      "Image too large for vision. Downscale and retry.",
    );
  }
  const header = dataUrl.slice(0, comma + 1).toLowerCase();
  if (
    !header.startsWith("data:image/jpeg;base64,") &&
    !header.startsWith("data:image/jpg;base64,") &&
    !header.startsWith("data:image/png;base64,")
  ) {
    throw new AiHttpError(400, "Vision accepts JPEG or PNG only.");
  }
}
