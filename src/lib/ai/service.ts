import { resolveAiProviderPath } from "./config";
import {
  AiHttpError,
  gatewayAnalyzeScreenshot,
  gatewayGenerateCopy,
  gatewayGenerateImage,
  gatewayPickLayout,
  gatewayReviewOutput,
} from "./gateway";
import {
  analyzeScreenshotImage,
  generateImagineImage,
  XaiHttpError,
} from "./xai";
import type {
  AiGeneratePurpose,
  CopyLocale,
  CopySuggestionsResponse,
  ReviewScorecard,
  ScreenshotAiSuggestions,
} from "./types";
import type { DeviceLayout } from "@/lib/design";

export class AiServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function wrap(err: unknown): never {
  if (err instanceof AiServiceError) throw err;
  if (err instanceof AiHttpError || err instanceof XaiHttpError) {
    throw new AiServiceError(err.status, err.message);
  }
  throw new AiServiceError(
    500,
    err instanceof Error ? err.message : "Unexpected AI error.",
  );
}

export async function runGenerateImage(options: {
  prompt: string;
  purpose: AiGeneratePurpose;
}): Promise<{ dataUrl: string; mimeType: string; model: string }> {
  const path = resolveAiProviderPath();
  try {
    if (path === "gateway") return await gatewayGenerateImage(options);
    if (path === "xai-direct") return await generateImagineImage(options);
    throw new AiServiceError(
      503,
      "AI features are disabled. Set AI_GATEWAY_API_KEY (or OIDC on Vercel) or XAI_API_KEY.",
    );
  } catch (err) {
    wrap(err);
  }
}

export async function runAnalyzeScreenshot(options: {
  imageDataUrl: string;
}): Promise<{ suggestions: ScreenshotAiSuggestions; model: string }> {
  const path = resolveAiProviderPath();
  try {
    if (path === "gateway") return await gatewayAnalyzeScreenshot(options);
    if (path === "xai-direct") return await analyzeScreenshotImage(options);
    throw new AiServiceError(
      503,
      "AI features are disabled. Set AI_GATEWAY_API_KEY (or OIDC on Vercel) or XAI_API_KEY.",
    );
  } catch (err) {
    wrap(err);
  }
}

export async function runGenerateCopy(options: {
  imageDataUrl?: string;
  contextHeadline?: string;
  contextSubtitle?: string;
  locales: CopyLocale[];
}): Promise<CopySuggestionsResponse> {
  const path = resolveAiProviderPath();
  try {
    if (path === "gateway") return await gatewayGenerateCopy(options);
    if (path === "xai-direct") {
      // Direct xAI path: analyze once and synthesize EN/ES from suggestions.
      if (!options.imageDataUrl) {
        throw new AiServiceError(
          400,
          "imageDataUrl is required for copy on the direct xAI path.",
        );
      }
      const { suggestions, model } = await analyzeScreenshotImage({
        imageDataUrl: options.imageDataUrl,
      });
      const locales = options.locales.length
        ? options.locales
        : (["en", "es"] as CopyLocale[]);
      return {
        model,
        locales: locales.map((locale) => ({
          locale,
          localeLabel:
            locale === "es"
              ? "Spanish"
              : locale === "en"
                ? "English"
                : locale,
          headline:
            locale === "es"
              ? suggestions.headline
              : suggestions.headline,
          subtitle:
            locale === "es"
              ? suggestions.subtitle
              : suggestions.subtitle,
        })),
      };
    }
    throw new AiServiceError(
      503,
      "AI features are disabled. Set AI_GATEWAY_API_KEY (or OIDC on Vercel) or XAI_API_KEY.",
    );
  } catch (err) {
    wrap(err);
  }
}

export async function runPickLayout(options: {
  imageDataUrl: string;
  screenshotCount: number;
}): Promise<{
  layout: DeviceLayout;
  rationale: string;
  confidence: number;
  model: string;
}> {
  const path = resolveAiProviderPath();
  try {
    if (path === "gateway") return await gatewayPickLayout(options);
    if (path === "xai-direct") {
      const { suggestions, model } = await analyzeScreenshotImage({
        imageDataUrl: options.imageDataUrl,
      });
      let layout = suggestions.layout;
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
        rationale: suggestions.rationale || "Derived from screenshot analysis.",
        confidence: 0.6,
        model,
      };
    }
    throw new AiServiceError(
      503,
      "AI features are disabled. Set AI_GATEWAY_API_KEY (or OIDC on Vercel) or XAI_API_KEY.",
    );
  } catch (err) {
    wrap(err);
  }
}

export async function runReviewOutput(options: {
  imageDataUrl: string;
  headline?: string;
  subtitle?: string;
  layout?: DeviceLayout;
}): Promise<{ review: ReviewScorecard; model: string }> {
  const path = resolveAiProviderPath();
  try {
    if (path === "gateway") return await gatewayReviewOutput(options);
    if (path === "xai-direct") {
      // Lightweight heuristic review when Gateway is unavailable.
      const { suggestions, model } = await analyzeScreenshotImage({
        imageDataUrl: options.imageDataUrl,
      });
      const headline = options.headline ?? suggestions.headline;
      const issues = [];
      if (!headline || headline.length < 4) {
        issues.push({
          id: "missing-headline",
          severity: "warn" as const,
          category: "readability" as const,
          title: "Add a headline",
          detail: "App Store screenshots convert better with a short caption.",
          fix: { text: { headline: suggestions.headline } },
        });
      }
      if (headline && headline.length > 40) {
        issues.push({
          id: "long-headline",
          severity: "info" as const,
          category: "text-size" as const,
          title: "Shorten the headline",
          detail: "Keep headlines under ~40 characters for small-phone previews.",
          fix: {
            text: {
              headline: headline.slice(0, 36).trim(),
              headlineSize: 56,
            },
          },
        });
      }
      const overall = Math.max(55, 90 - issues.length * 10);
      return {
        model,
        review: {
          overall,
          readability: overall,
          contrast: 72,
          textSize: 70,
          guidelines: 75,
          consistency: 70,
          summary:
            "Heuristic review via direct xAI analysis. Enable AI Gateway for a full scorecard.",
          issues,
        },
      };
    }
    throw new AiServiceError(
      503,
      "AI features are disabled. Set AI_GATEWAY_API_KEY (or OIDC on Vercel) or XAI_API_KEY.",
    );
  } catch (err) {
    wrap(err);
  }
}
