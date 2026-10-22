/**
 * AI Gateway + xAI model choices and usage caps for ASC Studio.
 *
 * Auth (prefer Gateway):
 * - AI_GATEWAY_API_KEY — local / CI / non-OIDC
 * - VERCEL_OIDC_TOKEN — automatic on Vercel deployments (and after `vercel env pull`)
 * Fallback: XAI_API_KEY — direct xAI HTTP when Gateway credentials are absent
 *
 * Models (AI Gateway provider/model ids from https://ai-gateway.vercel.sh/v1/models):
 * - Image: spacexai/grok-imagine-image
 * - Vision / text: spacexai/grok-build-0.1
 */

export const GATEWAY_IMAGE_MODEL = "spacexai/grok-imagine-image";
export const GATEWAY_VISION_MODEL = "spacexai/grok-build-0.1";
export const GATEWAY_COPY_MODEL = "spacexai/grok-build-0.1";

/** Legacy direct-xAI model ids (fallback path). */
export const XAI_API_BASE = "https://api.x.ai/v1";
export const XAI_IMAGE_MODEL = "grok-imagine-image";
export const XAI_VISION_MODEL = "grok-build-0.1";

export const XAI_IMAGE_PRICE_USD = 0.02;
export const XAI_IMAGE_PRICE_SOURCE =
  "https://docs.x.ai/docs/models (Imagine Pricing) / https://docs.x.ai/docs/models/grok-imagine-image";
export const XAI_VISION_INPUT_PER_MILLION_USD = 1.0;
export const XAI_VISION_OUTPUT_PER_MILLION_USD = 2.0;
export const XAI_VISION_PRICE_SOURCE =
  "https://docs.x.ai/docs/models (Text API Pricing) / https://docs.x.ai/docs/models/grok-build-0.1";

export const DEFAULT_PER_IP_PER_MINUTE = 5;
export const DEFAULT_PER_IP_PER_DAY = 30;
export const DEFAULT_GLOBAL_PER_DAY = 200;
export const DEFAULT_MAX_PROMPT_LENGTH = 500;
export const DEFAULT_VISION_MAX_EDGE = 768;
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

export function getAiGatewayApiKey(): string | null {
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  return key ? key : null;
}

export function hasVercelOidc(): boolean {
  return Boolean(process.env.VERCEL_OIDC_TOKEN?.trim());
}

/** True when AI SDK can authenticate to Vercel AI Gateway. */
export function isGatewayConfigured(): boolean {
  return getAiGatewayApiKey() != null || hasVercelOidc();
}

export function isXaiConfigured(): boolean {
  return getXaiApiKey() != null;
}

/** Any usable AI path (Gateway preferred, direct xAI as fallback). */
export function isAiConfigured(): boolean {
  return isGatewayConfigured() || isXaiConfigured();
}

export type AiProviderPath = "gateway" | "xai-direct" | "none";

export function resolveAiProviderPath(): AiProviderPath {
  if (isGatewayConfigured()) return "gateway";
  if (isXaiConfigured()) return "xai-direct";
  return "none";
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

function missingCredentialsNote(path: AiProviderPath): string | null {
  if (path === "gateway") return null;
  if (path === "xai-direct") {
    return "Using direct XAI_API_KEY fallback. For Vercel AI Gateway, set AI_GATEWAY_API_KEY (or rely on VERCEL_OIDC_TOKEN on Vercel).";
  }
  return [
    "AI features are disabled. David must set one of:",
    "• AI_GATEWAY_API_KEY — Vercel AI Gateway API key (recommended for local + preview), or",
    "• Rely on VERCEL_OIDC_TOKEN on Vercel deployments (automatic when the project is linked and Gateway is enabled on the team), or",
    "• XAI_API_KEY — legacy direct xAI fallback for image + vision only.",
  ].join(" ");
}

export function publicAiStatus() {
  const caps = getRateLimitConfig();
  const path = resolveAiProviderPath();
  const enabled = path !== "none";
  const imageId =
    path === "gateway" ? GATEWAY_IMAGE_MODEL : XAI_IMAGE_MODEL;
  const visionId =
    path === "gateway" ? GATEWAY_VISION_MODEL : XAI_VISION_MODEL;

  return {
    enabled,
    provider: path,
    gateway: {
      configured: isGatewayConfigured(),
      viaApiKey: getAiGatewayApiKey() != null,
      viaOidc: hasVercelOidc(),
    },
    xaiDirect: {
      configured: isXaiConfigured(),
    },
    models: {
      image: {
        id: imageId,
        priceUsdPerImage: XAI_IMAGE_PRICE_USD,
        source: XAI_IMAGE_PRICE_SOURCE,
      },
      vision: {
        id: visionId,
        inputUsdPerMillionTokens: XAI_VISION_INPUT_PER_MILLION_USD,
        outputUsdPerMillionTokens: XAI_VISION_OUTPUT_PER_MILLION_USD,
        source: XAI_VISION_PRICE_SOURCE,
      },
      copy: {
        id: path === "gateway" ? GATEWAY_COPY_MODEL : XAI_VISION_MODEL,
      },
    },
    caps: {
      perIpPerMinute: caps.perIpPerMinute,
      perIpPerDay: caps.perIpPerDay,
      globalPerDay: caps.globalPerDay,
      maxPromptLength: caps.maxPromptLength,
      visionMaxEdge: caps.visionMaxEdge,
    },
    envVarsNeeded: [
      "AI_GATEWAY_API_KEY (or OIDC on Vercel)",
      "XAI_API_KEY (optional direct fallback / BYOK)",
      "XAI_RATE_LIMIT_PER_IP_PER_MINUTE",
      "XAI_RATE_LIMIT_PER_IP_PER_DAY",
      "XAI_RATE_LIMIT_GLOBAL_PER_DAY",
    ],
    note: missingCredentialsNote(path),
  };
}
