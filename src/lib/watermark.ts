/**
 * Free-plan export badge. Drawn onto the FINAL opaque canvas after all other
 * layers, so it never changes ASC pixel dimensions and the PNG stays RGB.
 *
 * NOTE: composition is client-side, so this is a deterrent, not DRM. Server-
 * enforced Pro value lives in AI quotas and cloud presets.
 */

import { canvasFontFamily } from "./fonts";

export const WATERMARK_TEXT =
  process.env.NEXT_PUBLIC_WATERMARK_TEXT || "Made with ASC Studio · ascstudio.app";

export interface BadgeRect {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  paddingX: number;
  radius: number;
}

/**
 * Bottom-right badge geometry for a canvas. `textWidth` is the measured width
 * of the label at `fontSize` (pass `estimateTextWidth` in tests).
 */
export function watermarkBadgeRect(
  canvasWidth: number,
  canvasHeight: number,
  measure: (fontSize: number) => number = (fs) => estimateTextWidth(WATERMARK_TEXT, fs),
  minFontSize = 12,
): BadgeRect {
  const short = Math.min(canvasWidth, canvasHeight);
  const fontSize = Math.max(minFontSize, Math.round(short * 0.022));
  const paddingX = Math.round(fontSize * 0.8);
  const height = Math.round(fontSize * 2);
  const margin = Math.max(8, Math.round(short * 0.025));
  const maxWidth = canvasWidth - margin * 2;
  const width = Math.min(maxWidth, Math.ceil(measure(fontSize)) + paddingX * 2);
  return {
    x: canvasWidth - margin - width,
    y: canvasHeight - margin - height,
    width,
    height,
    fontSize,
    paddingX,
    radius: Math.round(height / 2),
  };
}

/** Rough width for sans-serif text (avg glyph ≈ 0.55em). */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  text = WATERMARK_TEXT,
  /** Scaled previews pass their scale so the badge matches the export. */
  scale = 1,
): BadgeRect {
  ctx.save();
  // Canvas can't resolve CSS variables; resolve the real family name.
  const family = canvasFontFamily("source-sans");
  const fontFor = (fs: number) => `600 ${fs}px ${family}`;
  const rect = watermarkBadgeRect(
    canvasWidth,
    canvasHeight,
    (fs) => {
      ctx.font = fontFor(fs);
      return ctx.measureText(text).width;
    },
    Math.max(4, 12 * scale),
  );
  ctx.font = fontFor(rect.fontSize);
  ctx.fillStyle = "rgba(18, 32, 42, 0.62)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, rect.radius);
  } else {
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
  }
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(
    text,
    rect.x + rect.paddingX,
    rect.y + rect.height / 2,
    rect.width - rect.paddingX * 2,
  );
  ctx.restore();
  return rect;
}
