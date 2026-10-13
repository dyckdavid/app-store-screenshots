import {
  getRateLimitConfig,
  getXaiApiKey,
  XAI_API_BASE,
  XAI_IMAGE_MODEL,
  XAI_VISION_MODEL,
} from "./config";
import type {
  AiGeneratePurpose,
  ScreenshotAiSuggestions,
  SuggestedBackground,
  SuggestedDevice,
} from "./types";
import type { DeviceLayout, TextAlign, TextPosition } from "@/lib/design";
import type { GradientDirection } from "@/lib/background";

export class XaiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function authHeaders(): HeadersInit {
  const key = getXaiApiKey();
  if (!key) throw new XaiHttpError(503, "XAI_API_KEY is not configured.");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function purposePrefix(purpose: AiGeneratePurpose): string {
  if (purpose === "background") {
    return "App Store marketing screenshot BACKGROUND only. Abstract atmospheric backdrop, soft shapes, no text, no phones, no UI chrome, no logos. Full-bleed composition suitable behind a device frame. ";
  }
  return "App Store marketing DECORATIVE GRAPHIC LAYER on transparent-friendly solid color field if needed: single motif, sticker-like or floating accent (glow orb, soft ribbon, geometric flourish). No text, no device mockups, no logos. ";
}

export async function generateImagineImage(options: {
  prompt: string;
  purpose: AiGeneratePurpose;
}): Promise<{ dataUrl: string; mimeType: string; model: string }> {
  const caps = getRateLimitConfig();
  const prompt = options.prompt.trim().slice(0, caps.maxPromptLength);
  if (!prompt) throw new XaiHttpError(400, "Prompt is required.");

  const fullPrompt = `${purposePrefix(options.purpose)}${prompt}`;

  const res = await fetch(`${XAI_API_BASE}/images/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: XAI_IMAGE_MODEL,
      prompt: fullPrompt,
      n: 1,
      response_format: "b64_json",
      aspect_ratio: options.purpose === "background" ? "9:16" : "1:1",
    }),
  });

  const payload = (await res.json().catch(() => null)) as {
    data?: Array<{ b64_json?: string; url?: string; mime_type?: string }>;
    error?: { message?: string };
  } | null;

  if (!res.ok) {
    throw new XaiHttpError(
      res.status,
      payload?.error?.message || `Image generation failed (${res.status}).`,
    );
  }

  const item = payload?.data?.[0];
  if (!item) throw new XaiHttpError(502, "Image generation returned no data.");

  const mimeType = item.mime_type || "image/jpeg";
  if (item.b64_json) {
    return {
      dataUrl: `data:${mimeType};base64,${item.b64_json}`,
      mimeType,
      model: XAI_IMAGE_MODEL,
    };
  }

  if (item.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) {
      throw new XaiHttpError(502, "Failed to download generated image URL.");
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const resolvedMime = imgRes.headers.get("content-type") || mimeType;
    return {
      dataUrl: `data:${resolvedMime};base64,${buf.toString("base64")}`,
      mimeType: resolvedMime,
      model: XAI_IMAGE_MODEL,
    };
  }

  throw new XaiHttpError(502, "Image generation missing b64_json and url.");
}

const SUGGESTION_SCHEMA_HINT = `{
  "headline": string (max 48 chars, App Store marketing),
  "subtitle": string (max 64 chars),
  "layout": "single" | "dual-side" | "dual-overlap" | "dual-angled",
  "device": "iphone" | "ipad" | "mac" | "watch" | "dual" | "header" | "search",
  "backgroundStyle": either {"kind":"solid","color":"#rrggbb"} or {"kind":"gradient","from":"#rrggbb","to":"#rrggbb","direction":"vertical"|"horizontal"|"diagonal-down"|"diagonal-up"},
  "colorPalette": {"text":"#rrggbb","background":"#rrggbb","accent":"#rrggbb"},
  "textAlign": "left" | "center" | "right",
  "textPosition": "top" | "bottom",
  "rationale": string (one short sentence)
}`;

export async function analyzeScreenshotImage(options: {
  imageDataUrl: string;
}): Promise<{ suggestions: ScreenshotAiSuggestions; model: string }> {
  const caps = getRateLimitConfig();
  const dataUrl = options.imageDataUrl.trim();
  if (!dataUrl.startsWith("data:image/")) {
    throw new XaiHttpError(400, "Expected a data:image/...;base64,... payload.");
  }
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new XaiHttpError(400, "Malformed image data URL.");
  const b64 = dataUrl.slice(comma + 1);
  if (b64.length > caps.visionMaxBase64Chars) {
    throw new XaiHttpError(
      413,
      `Image too large for vision (max ~${caps.visionMaxEdge}px edge / capped payload). Downscale and retry.`,
    );
  }
  // JPEG/PNG only per xAI image-input docs; client converts WebP before send.
  const header = dataUrl.slice(0, comma + 1).toLowerCase();
  if (
    !header.startsWith("data:image/jpeg;base64,") &&
    !header.startsWith("data:image/jpg;base64,") &&
    !header.startsWith("data:image/png;base64,")
  ) {
    throw new XaiHttpError(400, "Vision accepts JPEG or PNG only.");
  }

  // Chat Completions + low detail keeps vision under serverless time budgets
  // (Responses API + reasoning models can exceed 60s on cold paths).
  const userText = `Return ONLY JSON (no markdown) for App Store marketing styling. Schema: ${SUGGESTION_SCHEMA_HINT}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 110_000);
  let res: Response;
  try {
    res = await fetch(`${XAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: authHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        model: XAI_VISION_MODEL,
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "You analyze App Store screenshots. Reply with a single JSON object only.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "low" },
              },
              { type: "text", text: userText },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new XaiHttpError(504, "Vision analysis timed out waiting for xAI.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const payload = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { message?: string };
  } | null;

  if (!res.ok) {
    throw new XaiHttpError(
      res.status,
      payload?.error?.message || `Vision analysis failed (${res.status}).`,
    );
  }

  const text = payload?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new XaiHttpError(502, "Vision model returned empty text.");
  const parsed = parseSuggestionsJson(text);
  return { suggestions: parsed, model: XAI_VISION_MODEL };
}

function parseSuggestionsJson(raw: string): ScreenshotAiSuggestions {
  const jsonText = extractJsonObject(raw);
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new XaiHttpError(502, "Vision model returned non-JSON suggestions.");
  }
  if (!data || typeof data !== "object") {
    throw new XaiHttpError(502, "Invalid suggestions object.");
  }
  const o = data as Record<string, unknown>;
  return {
    headline: clampStr(o.headline, 48) || "Meet your next favorite app",
    subtitle: clampStr(o.subtitle, 64),
    layout: asLayout(o.layout),
    device: asDevice(o.device),
    backgroundStyle: asBackground(o.backgroundStyle),
    colorPalette: {
      text: asHex(
        (o.colorPalette as Record<string, unknown> | undefined)?.text,
        "#ffffff",
      ),
      background: asHex(
        (o.colorPalette as Record<string, unknown> | undefined)?.background,
        "#0a0f14",
      ),
      accent: asHex(
        (o.colorPalette as Record<string, unknown> | undefined)?.accent,
        "#0f766e",
      ),
    },
    textAlign: asAlign(o.textAlign),
    textPosition: asPosition(o.textPosition),
    rationale: clampStr(o.rationale, 160),
  };
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new XaiHttpError(502, "Could not find JSON object in model output.");
}

function clampStr(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function asHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(v) ? v : fallback;
}

function asLayout(value: unknown): DeviceLayout {
  const allowed: DeviceLayout[] = [
    "single",
    "dual-side",
    "dual-overlap",
    "dual-angled",
  ];
  return allowed.includes(value as DeviceLayout)
    ? (value as DeviceLayout)
    : "single";
}

function asDevice(value: unknown): SuggestedDevice {
  const allowed: SuggestedDevice[] = [
    "iphone",
    "ipad",
    "mac",
    "watch",
    "dual",
    "header",
    "search",
  ];
  return allowed.includes(value as SuggestedDevice)
    ? (value as SuggestedDevice)
    : "iphone";
}

function asAlign(value: unknown): TextAlign {
  const allowed: TextAlign[] = ["left", "center", "right"];
  return allowed.includes(value as TextAlign) ? (value as TextAlign) : "center";
}

function asPosition(value: unknown): TextPosition {
  return value === "bottom" ? "bottom" : "top";
}

function asBackground(value: unknown): SuggestedBackground {
  if (!value || typeof value !== "object") {
    return { kind: "solid", color: "#0a0f14" };
  }
  const o = value as Record<string, unknown>;
  if (o.kind === "gradient") {
    const dirs: GradientDirection[] = [
      "vertical",
      "horizontal",
      "diagonal-down",
      "diagonal-up",
    ];
    const direction = dirs.includes(o.direction as GradientDirection)
      ? (o.direction as GradientDirection)
      : "vertical";
    return {
      kind: "gradient",
      from: asHex(o.from, "#0b3d3a"),
      to: asHex(o.to, "#0a0f14"),
      direction,
    };
  }
  return { kind: "solid", color: asHex(o.color, "#0a0f14") };
}
