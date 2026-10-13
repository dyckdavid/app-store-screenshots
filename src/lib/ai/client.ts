"use client";

import type { AiStatusResponse, ScreenshotAiSuggestions } from "./types";
import type { AiGeneratePurpose } from "./types";

export async function fetchAiStatus(): Promise<AiStatusResponse> {
  const res = await fetch("/api/ai/status", { method: "GET" });
  if (!res.ok) {
    return {
      enabled: false,
      models: {
        image: {
          id: "grok-imagine-image",
          priceUsdPerImage: 0.02,
          source: "",
        },
        vision: {
          id: "grok-build-0.1",
          inputUsdPerMillionTokens: 1,
          outputUsdPerMillionTokens: 2,
          source: "",
        },
      },
      caps: {
        perIpPerMinute: 5,
        perIpPerDay: 30,
        globalPerDay: 200,
        maxPromptLength: 500,
        visionMaxEdge: 768,
      },
      note: "Could not load AI status.",
    };
  }
  return (await res.json()) as AiStatusResponse;
}

export async function generateAiImage(options: {
  prompt: string;
  purpose: AiGeneratePurpose;
}): Promise<{ dataUrl: string; mimeType: string; model: string }> {
  const res = await fetch("/api/ai/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    dataUrl?: string;
    mimeType?: string;
    model?: string;
  };
  if (!res.ok || !data.dataUrl) {
    throw new Error(data.error || `Generate failed (${res.status})`);
  }
  return {
    dataUrl: data.dataUrl,
    mimeType: data.mimeType || "image/jpeg",
    model: data.model || "grok-imagine-image",
  };
}

export async function analyzeScreenshot(options: {
  imageDataUrl: string;
}): Promise<{ suggestions: ScreenshotAiSuggestions; model: string }> {
  const res = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    suggestions?: ScreenshotAiSuggestions;
    model?: string;
  };
  if (!res.ok || !data.suggestions) {
    throw new Error(data.error || `Analyze failed (${res.status})`);
  }
  return {
    suggestions: data.suggestions,
    model: data.model || "grok-build-0.1",
  };
}

/** Downscale + convert to JPEG data URL before vision calls. */
export async function downscaleImageForVision(
  source: Blob | HTMLImageElement | ImageBitmap,
  maxEdge = 768,
): Promise<string> {
  let bitmap: ImageBitmap;
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    bitmap = source;
  } else if (source instanceof Blob) {
    bitmap = await createImageBitmap(source);
  } else {
    bitmap = await createImageBitmap(source as HTMLImageElement);
  }

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable for downscale.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    if (!(typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap)) {
      bitmap.close();
    }
  }
}
