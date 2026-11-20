/**
 * Pure layout engine: canvas size + layout choice → caption box + device
 * slots. No DOM, fully unit-tested. Everything is proportional to the
 * canvas so one design reads the same at every App Store Connect size.
 *
 * Core rule: the caption and the devices live in SEPARATE regions — text is
 * never drawn over a device screen.
 */
import type { LayoutId } from "./model";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Anchor = "top" | "bottom" | "center";

export interface DeviceSlot {
  role: "primary" | "secondary";
  box: Box;
  anchor: Anchor;
  /** Degrees, clockwise. */
  rotation: number;
  /** Extra multiplier after contain-fit into `box`. */
  scale: number;
}

export type Arrangement = "stacked" | "side";

export interface SceneLayout {
  width: number;
  height: number;
  arrangement: Arrangement;
  caption: Box | null;
  /** Drawing order: back to front. */
  devices: DeviceSlot[];
  /** Rounded-corner radius for frameless cards (px). */
  cardRadius: number;
  /** Base headline size before fitting (px). */
  headlineBase: number;
}

export interface LayoutInput {
  width: number;
  height: number;
  layout: LayoutId;
  /** width / height of the primary device (frame or bare screenshot). */
  deviceAspect: number;
  hasCaption: boolean;
  hasSecondary: boolean;
  deviceScale?: number;
  /** Caption on the side for landscape layouts: "left" (default) or "right". */
}

export function chooseArrangement(width: number, height: number, deviceAspect: number): Arrangement {
  const canvasAspect = width / height;
  // Landscape canvas + upright device → caption beside the device.
  if (canvasAspect > 1.15 && deviceAspect < 1.15) return "side";
  return "stacked";
}

export function computeLayout(input: LayoutInput): SceneLayout {
  const { width: W, height: H, layout, hasCaption } = input;
  const deviceScale = input.deviceScale ?? 1;
  const arrangement = chooseArrangement(W, H, input.deviceAspect);
  const duo = layout === "duo" && input.hasSecondary;
  const rotation = layout === "tilt" ? -7 : 0;
  const tiltScale = layout === "tilt" ? 0.94 : 1;
  const cardRadius = Math.round(Math.min(W, H) * 0.045);

  if (arrangement === "stacked") {
    const m = W * 0.07;
    const capH = H * (W / H > 1.15 ? 0.2 : 0.19);
    const capTopY = H * 0.055;
    const gap = H * 0.03;
    const captionBottom = layout === "caption-bottom";

    let caption: Box | null = null;
    let region: Box;
    let anchor: Anchor;

    if (!hasCaption) {
      const bleed = layout === "hero";
      region = bleed
        ? { x: m, y: H * 0.07, width: W - 2 * m, height: H * 0.99 }
        : { x: m, y: H * 0.06, width: W - 2 * m, height: H * 0.88 };
      anchor = bleed ? "top" : "center";
    } else if (captionBottom) {
      caption = { x: m, y: H - capTopY - capH, width: W - 2 * m, height: capH };
      const top = -H * 0.06;
      region = { x: m, y: top, width: W - 2 * m, height: caption.y - gap - top };
      anchor = "bottom";
    } else {
      caption = { x: m, y: capTopY, width: W - 2 * m, height: capH };
      const top = caption.y + capH + gap;
      if (layout === "hero") {
        region = { x: m, y: top, width: W - 2 * m, height: H * 1.06 - top };
        anchor = "top";
      } else {
        region = { x: m, y: top, width: W - 2 * m, height: H * 0.955 - top };
        anchor = "center";
      }
    }

    const devices: DeviceSlot[] = duo
      ? duoSlots(region, anchor, deviceScale, "stacked")
      : [{ role: "primary", box: region, anchor, rotation, scale: deviceScale * tiltScale }];

    return {
      width: W,
      height: H,
      arrangement,
      caption,
      devices,
      cardRadius,
      headlineBase: caption ? Math.min(caption.width * 0.088, caption.height * 0.34) : 0,
    };
  }

  // side-by-side: caption column + device column
  const m = W * 0.05;
  const capW = W * 0.37;
  const captionRight = layout === "caption-bottom";
  let caption: Box | null = null;
  let region: Box;
  if (!hasCaption) {
    region = { x: m, y: H * 0.06, width: W - 2 * m, height: H * 0.88 };
  } else {
    caption = {
      x: captionRight ? W - m - capW : m,
      y: H * 0.12,
      width: capW,
      height: H * 0.76,
    };
    const devX = captionRight ? m : m + capW + W * 0.03;
    region = { x: devX, y: 0, width: W - 2 * m - capW - W * 0.03, height: H };
  }
  const bleed = layout === "hero";
  const box: Box = bleed
    ? { x: region.x, y: H * 0.1, width: region.width, height: H * 0.98 }
    : { x: region.x, y: H * 0.07, width: region.width, height: H * 0.86 };
  const anchor: Anchor = bleed ? "top" : "center";
  const devices: DeviceSlot[] = duo
    ? duoSlots(box, anchor, deviceScale, "side")
    : [{ role: "primary", box, anchor, rotation, scale: deviceScale * tiltScale }];

  return {
    width: W,
    height: H,
    arrangement,
    caption,
    devices,
    cardRadius,
    headlineBase: caption ? Math.min(caption.width * 0.125, caption.height * 0.16) : 0,
  };
}

function duoSlots(region: Box, anchor: Anchor, deviceScale: number, arrangement: Arrangement): DeviceSlot[] {
  // Front device on the right, the next screenshot peeking from behind it.
  const back: Box = {
    x: region.x,
    y: region.y + region.height * 0.06,
    width: region.width * 0.66,
    height: region.height,
  };
  const front: Box = {
    x: region.x + region.width * 0.3,
    y: region.y,
    width: region.width * 0.7,
    height: region.height,
  };
  const s = arrangement === "side" ? 0.96 : 1;
  return [
    { role: "secondary", box: back, anchor, rotation: -6, scale: deviceScale * 0.9 * s },
    { role: "primary", box: front, anchor, rotation: 4, scale: deviceScale * s },
  ];
}

/** Contain-fit an object into a slot, apply slot scale, then anchor. */
export function placeInSlot(objW: number, objH: number, slot: DeviceSlot): Box {
  const fit = Math.min(slot.box.width / objW, slot.box.height / objH) * slot.scale;
  const width = objW * fit;
  const height = objH * fit;
  const x = slot.box.x + (slot.box.width - width) / 2;
  const y =
    slot.anchor === "top"
      ? slot.box.y
      : slot.anchor === "bottom"
        ? slot.box.y + slot.box.height - height
        : slot.box.y + (slot.box.height - height) / 2;
  return { x, y, width, height };
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// ---------------------------------------------------------------------------
// Text fitting
// ---------------------------------------------------------------------------

export type Measure = (text: string, fontSize: number) => number;

/** Greedy word wrap honoring explicit "\n" breaks. */
export function wrapText(text: string, maxWidth: number, size: number, measure: Measure): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    let line = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const next = `${line} ${words[i]}`;
      if (measure(next, size) <= maxWidth) line = next;
      else {
        out.push(line);
        line = words[i]!;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * Balanced wrap: same number of lines as greedy, but the narrowest width
 * that achieves it — avoids a lonely last word.
 */
export function wrapBalanced(text: string, maxWidth: number, size: number, measure: Measure): string[] {
  const greedy = wrapText(text, maxWidth, size, measure);
  if (greedy.length <= 1) return greedy;
  let lo = maxWidth * 0.5;
  let hi = maxWidth;
  let best = greedy;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const lines = wrapText(text, mid, size, measure);
    const fits = lines.length <= greedy.length && lines.every((l) => measure(l, size) <= mid + 0.5);
    if (fits) {
      best = lines;
      hi = mid;
    } else lo = mid;
  }
  return best;
}

export interface FittedCaption {
  headlineSize: number;
  subtitleSize: number;
  headlineLines: string[];
  subtitleLines: string[];
  lineHeight: number;
  subtitleLineHeight: number;
  gap: number;
  blockHeight: number;
}

export const HEADLINE_LINE_HEIGHT = 1.08;
export const SUBTITLE_LINE_HEIGHT = 1.3;

/**
 * Largest size ≤ base (× scale) where the headline wraps to ≤ maxLines,
 * no line overflows, and headline + subtitle fit the caption box height.
 */
export function fitCaption(
  headline: string,
  subtitle: string,
  box: Box,
  base: number,
  measureHeadline: Measure,
  measureSubtitle: Measure,
  opts: { maxLines?: number; scale?: number } = {},
): FittedCaption {
  const maxLines = opts.maxLines ?? 3;
  const start = base * (opts.scale ?? 1);
  const min = start * 0.3;
  let size = start;
  let result: FittedCaption | null = null;
  while (size >= min) {
    const sub = size * 0.5;
    const hl = headline.trim() ? wrapBalanced(headline, box.width, size, measureHeadline) : [];
    const sl = subtitle.trim() ? wrapBalanced(subtitle, box.width, sub, measureSubtitle) : [];
    const lineHeight = size * HEADLINE_LINE_HEIGHT;
    const subLineHeight = sub * SUBTITLE_LINE_HEIGHT;
    const gap = hl.length && sl.length ? sub * 0.7 : 0;
    const blockHeight = hl.length * lineHeight + gap + sl.length * subLineHeight;
    result = {
      headlineSize: size,
      subtitleSize: sub,
      headlineLines: hl,
      subtitleLines: sl,
      lineHeight,
      subtitleLineHeight: subLineHeight,
      gap,
      blockHeight,
    };
    const overflow =
      hl.some((l) => measureHeadline(l, size) > box.width + 0.5) ||
      sl.some((l) => measureSubtitle(l, sub) > box.width + 0.5);
    if (hl.length <= maxLines && sl.length <= 2 && blockHeight <= box.height && !overflow) {
      return result;
    }
    size *= 0.94;
  }
  return result!;
}

// ---------------------------------------------------------------------------
// Device choice — driven by the SCREENSHOT's shape, not the canvas, so an
// iPhone capture is never cropped into an iPad screen (or vice versa).
// ---------------------------------------------------------------------------

export type DeviceFamily = "iphone" | "ipad" | "mac" | "card";

export function deviceFamilyForShot(shotW: number, shotH: number): DeviceFamily {
  const r = Math.min(shotW, shotH) / Math.max(shotW, shotH);
  if (r < 0.56) return "iphone"; // 19.5:9 phones ≈ 0.46
  if (r < 0.66) return shotW > shotH ? "mac" : "card"; // 16:10 Mac ≈ 0.625 (iPad 11" ≈ 0.69)
  return "ipad"; // 4:3 iPad ≈ 0.75
}
