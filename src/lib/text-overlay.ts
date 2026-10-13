import type { TextStyle } from "./design";
import { canvasFontFamily } from "./fonts";

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i]!;
    }
  }
  lines.push(current);
  return lines;
}

/**
 * Draw headline + subtitle onto the ASC canvas.
 * Position is top or bottom; alignment left/center/right within side padding.
 */
export function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  style: TextStyle,
): void {
  const headline = style.headline.trim();
  const subtitle = style.subtitle.trim();
  if (!headline && !subtitle) return;

  const family = canvasFontFamily(style.fontId);
  const sidePad = canvasW * 0.08;
  const maxWidth = canvasW - sidePad * 2;
  const inset = (style.insetPercent / 100) * canvasH;

  ctx.save();
  ctx.fillStyle = style.color;
  ctx.textAlign = style.align;
  ctx.textBaseline = "top";

  const x =
    style.align === "left"
      ? sidePad
      : style.align === "right"
        ? canvasW - sidePad
        : canvasW / 2;

  const headlineLines = headline
    ? (() => {
        ctx.font = `${style.weight} ${style.headlineSize}px ${family}`;
        return wrapLines(ctx, headline, maxWidth);
      })()
    : [];
  const subtitleLines = subtitle
    ? (() => {
        ctx.font = `500 ${style.subtitleSize}px ${family}`;
        return wrapLines(ctx, subtitle, maxWidth);
      })()
    : [];

  const headlineLineH = style.headlineSize * 1.15;
  const subtitleLineH = style.subtitleSize * 1.25;
  const gap = headlineLines.length && subtitleLines.length ? style.subtitleSize * 0.45 : 0;
  const blockH =
    headlineLines.length * headlineLineH +
    gap +
    subtitleLines.length * subtitleLineH;

  let y =
    style.position === "top" ? inset : canvasH - inset - blockH;

  if (headlineLines.length) {
    ctx.font = `${style.weight} ${style.headlineSize}px ${family}`;
    // Soft shadow for legibility on busy backgrounds
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = Math.max(4, style.headlineSize * 0.08);
    ctx.shadowOffsetY = Math.max(1, style.headlineSize * 0.02);
    for (const line of headlineLines) {
      ctx.fillText(line, x, y);
      y += headlineLineH;
    }
    ctx.shadowColor = "transparent";
    y += gap;
  }

  if (subtitleLines.length) {
    ctx.font = `500 ${style.subtitleSize}px ${family}`;
    ctx.globalAlpha = 0.92;
    for (const line of subtitleLines) {
      ctx.fillText(line, x, y);
      y += subtitleLineH;
    }
  }

  ctx.restore();
}

/** Preview-only alignment guides (center + safe text bands). */
export function drawGuides(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  insetPercent: number,
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(15, 118, 110, 0.45)";
  ctx.lineWidth = Math.max(1, canvasW * 0.0015);
  ctx.setLineDash([canvasW * 0.01, canvasW * 0.01]);

  // Center cross
  ctx.beginPath();
  ctx.moveTo(canvasW / 2, 0);
  ctx.lineTo(canvasW / 2, canvasH);
  ctx.moveTo(0, canvasH / 2);
  ctx.lineTo(canvasW, canvasH / 2);
  ctx.stroke();

  // Text inset bands
  const inset = (insetPercent / 100) * canvasH;
  ctx.strokeStyle = "rgba(15, 118, 110, 0.3)";
  ctx.beginPath();
  ctx.moveTo(0, inset);
  ctx.lineTo(canvasW, inset);
  ctx.moveTo(0, canvasH - inset);
  ctx.lineTo(canvasW, canvasH - inset);
  ctx.stroke();

  ctx.restore();
}
