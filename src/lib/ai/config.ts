/**
 * xAI model choices and usage caps for ASC Studio AI features.
 *
 * Sources (checked against docs.x.ai):
 * - Models / pricing: https://docs.x.ai/docs/models
 * - Pricing page: https://docs.x.ai/developers/pricing
 * - grok-imagine-image: https://docs.x.ai/docs/models/grok-imagine-image
 * - grok-build-0.1 (vision): https://docs.x.ai/docs/models/grok-build-0.1
 */

export const XAI_API_BASE = "https://api.x.ai/v1";

/** Cheapest image-generation model currently listed ($0.02 / image). */
export const XAI_IMAGE_MODEL = "grok-imagine-image";
export const XAI_IMAGE_PRICE_USD = 0.02;
export const XAI_IMAGE_PRICE_SOURCE =
  "https://docs.x.ai/docs/models (Imagine Pricing) / https://docs.x.ai/docs/models/grok-imagine-image";

/**
 * Cheapest text model that accepts image input (text+image → text).
 * $1.00 / 1M input tokens, $2.00 / 1M output tokens (< 200k prompt).
 */
export const XAI_VISION_MODEL = "grok-build-0.1";
export const XAI_VISION_INPUT_PER_MILLION_USD = 1.0;
export const XAI_VISION_OUTPUT_PER_MILLION_USD = 2.0;
export const XAI_VISION_PRICE_SOURCE =
  "https://docs.x.ai/docs/models (Text API Pricing) / https://docs.x.ai/docs/models/grok-build-0.1";

export const DEFAULT_PER_IP_PER_MINUTE = 5;
export const DEFAULT_PER_IP_PER_DAY = 30;
export const DEFAULT_GLOBAL_PER_DAY = 200;
export const DEFAULT_MAX_PROMPT_LENGTH = 500;
/** Longest edge sent to vision after client/server downscale. */
export const DEFAULT_VISION_MAX_EDGE = 768;
/** Max base64 characters accepted for vision image payloads (~600KB raw). */
export const DEFAULT_VISION_MAX_BASE64_CHARS = 900_000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getXaiApiKey(): string | null {
  const key = process.env.XAI_API_KEY?.trim();
  return key ? key : null;
}

export function isAiConfigured(): boolean {
  return getXaiApiKey() != null;
}

export function getRateLimitConfig() {
  return {
    perIpPerMinute: envInt(
      "XAI_RATE_LIMIT_PER_IP_PER_MINUTE",
      DEFAULT_PER_IP_PER_MINUTE,
    ),
    perIpPerDay: envInt("XAI_RATE_LIMIT_PER_IP_PER_DAY", DEFAULT_PER_IP_PER_DAY),
    globalPerDay: envInt(
      "XAI_RATE_LIMIT_GLOBAL_PER_DAY",
      DEFAULT_GLOBAL_PER_DAY,
    ),
    maxPromptLength: envInt(
      "XAI_MAX_PROMPT_LENGTH",
      DEFAULT_MAX_PROMPT_LENGTH,
    ),
    visionMaxEdge: envInt("XAI_VISION_MAX_EDGE", DEFAULT_VISION_MAX_EDGE),
    visionMaxBase64Chars: envInt(
      "XAI_VISION_MAX_BASE64_CHARS",
      DEFAULT_VISION_MAX_BASE64_CHARS,
    ),
  };
}

export function publicAiStatus() {
  const caps = getRateLimitConfig();
  return {
    enabled: isAiConfigured(),
    models: {
      image: {
        id: XAI_IMAGE_MODEL,
        priceUsdPerImage: XAI_IMAGE_PRICE_USD,
        source: XAI_IMAGE_PRICE_SOURCE,
      },
      vision: {
        id: XAI_VISION_MODEL,
        inputUsdPerMillionTokens: XAI_VISION_INPUT_PER_MILLION_USD,
        outputUsdPerMillionTokens: XAI_VISION_OUTPUT_PER_MILLION_USD,
        source: XAI_VISION_PRICE_SOURCE,
      },
    },
    caps: {
      perIpPerMinute: caps.perIpPerMinute,
      perIpPerDay: caps.perIpPerDay,
      globalPerDay: caps.globalPerDay,
      maxPromptLength: caps.maxPromptLength,
      visionMaxEdge: caps.visionMaxEdge,
    },
    note: isAiConfigured()
      ? null
      : "AI features are disabled — set XAI_API_KEY on the server to enable.",
  };
}
