/**
 * Canvas renderer for one App Store screenshot. Layout decisions live in
 * layout.ts (pure, tested); this file only draws.
 *
 * Frame compose rule (unchanged): the screenshot is cover-filled into the
 * device screen first (renderFramedDevice), then the whole framed device is
 * scaled into its layout slot on the exact ASC canvas.
 */
import { encode as encodePng } from "fast-png";
import type { ScreenshotSize } from "@/lib/sizes";
import {
  beginRoundedRect,
  drawImageInRect,
  iphoneFrameProbeSize,
  loadFrameAsset,
  renderFramedDevice,
  type LoadedFrameAsset,
} from "@/lib/frames";
import { canvasFontFamily } from "@/lib/fonts";
import { drawWatermark } from "@/lib/watermark";
import { hexToRgb } from "./color";
import {
  computeLayout,
  deviceFamilyForShot,
  fitCaption,
  placeInSlot,
  type Box,
  type Measure,
  type SceneLayout,
} from "./layout";
import type { Background, ShotCopy, StudioStyle, Theme } from "./model";

export interface ShotRenderInput {
  size: ScreenshotSize;
  primary: ImageBitmap;
  secondary: ImageBitmap | null;
  copy: ShotCopy;
  style: StudioStyle;
  theme: Theme;
  /** Output scale (previews use < 1). Layout is proportional, so it's exact. */
  scale?: number;
  watermark?: boolean;
  backgroundImage?: ImageBitmap | null;
}

type DeviceKind = "frame" | "card" | "watch";

function orientationOf(bitmap: ImageBitmap): "portrait" | "landscape" {
  return bitmap.width > bitmap.height ? "landscape" : "portrait";
}

/** Which bezel (if any) a canvas uses, matching the SCREENSHOT's orientation. */
export async function deviceAssetFor(
  size: ScreenshotSize,
  shot: ImageBitmap,
  style: StudioStyle,
): Promise<{ kind: DeviceKind; asset: LoadedFrameAsset | null }> {
  if (size.platform === "watch") return { kind: "watch", asset: null };
  if (!style.frames || style.layout === "frameless") return { kind: "card", asset: null };
  const orientation = orientationOf(shot);
  const family = deviceFamilyForShot(shot.width, shot.height);
  try {
    if (family === "card") return { kind: "card", asset: null };
    if (family === "ipad") {
      const ipadId = size.platform === "ipad" && size.id.includes("11") ? "ipad-11" : "ipad-13";
      const asset = await loadFrameAsset({ ...size, id: `${ipadId}-${orientation}`, platform: "ipad", orientation });
      return asset ? { kind: "frame", asset } : { kind: "card", asset: null };
    }
    if (family === "mac") {
      const asset = await loadFrameAsset({ ...size, id: "mac-2880", platform: "mac", orientation: "landscape" });
      return asset ? { kind: "frame", asset } : { kind: "card", asset: null };
    }
    const asset = await loadFrameAsset({ ...iphoneFrameProbeSize(), orientation });
    return asset ? { kind: "frame", asset } : { kind: "card", asset: null };
  } catch {
    return { kind: "card", asset: null };
  }
}

/** Cache framed devices: rendering a full-res bezel is the slow part. */
const framedCache = new WeakMap<ImageBitmap, Map<string, HTMLCanvasElement>>();

function framed(shot: ImageBitmap, asset: LoadedFrameAsset): HTMLCanvasElement {
  let byAsset = framedCache.get(shot);
  if (!byAsset) {
    byAsset = new Map();
    framedCache.set(shot, byAsset);
  }
  let canvas = byAsset.get(asset.key);
  if (!canvas) {
    canvas = renderFramedDevice(shot, asset);
    byAsset.set(asset.key, canvas);
  }
  return canvas;
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function paintBackground(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  bg: Background,
  image?: ImageBitmap | null,
): void {
  if (bg.kind === "solid") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  if (bg.kind === "linear") {
    // CSS semantics: 180deg = top → bottom.
    const a = ((bg.angle - 90) * Math.PI) / 180;
    const len = Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a));
    const cx = W / 2;
    const cy = H / 2;
    const dx = (Math.cos(a) * len) / 2;
    const dy = (Math.sin(a) * len) / 2;
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    g.addColorStop(0, bg.from);
    g.addColorStop(1, bg.to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  if (bg.kind === "mesh") {
    ctx.fillStyle = bg.base;
    ctx.fillRect(0, 0, W, H);
    const R = Math.max(W, H);
    for (const blob of bg.blobs) {
      const x = blob.x * W;
      const y = blob.y * H;
      const g = ctx.createRadialGradient(x, y, 0, x, y, blob.r * R);
      g.addColorStop(0, rgba(blob.color, 0.95));
      g.addColorStop(0.55, rgba(blob.color, 0.35));
      g.addColorStop(1, rgba(blob.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    return;
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  if (image) drawImageInRect(ctx, image, { x: 0, y: 0, width: W, height: H }, "cover");
  if (bg.dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.8, bg.dim)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function fontString(weight: number, size: number, family: string) {
  return `${weight} ${Math.max(1, Math.round(size))}px ${family}`;
}

/** Make sure the web font is actually loaded before measuring/drawing. */
export async function ensureFont(fontId: string, weight: number, sample: string): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  const family = canvasFontFamily(fontId);
  try {
    await Promise.all([
      document.fonts.load(fontString(weight, 64, family), sample || "Aa"),
      document.fonts.load(fontString(500, 64, family), sample || "Aa"),
    ]);
  } catch {
    // fall back to whatever the browser has
  }
}

function setTracking(ctx: CanvasRenderingContext2D, em: number, size: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = `${(em * size).toFixed(2)}px`;
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  box: Box,
  copy: ShotCopy,
  style: StudioStyle,
  color: string,
  base: number,
) {
  const family = canvasFontFamily(style.caption.fontId);
  const weight = style.caption.weight;
  const measureH: Measure = (t, s) => {
    ctx.font = fontString(weight, s, family);
    setTracking(ctx, -0.015, s);
    return ctx.measureText(t).width;
  };
  const measureS: Measure = (t, s) => {
    ctx.font = fontString(500, s, family);
    setTracking(ctx, 0, s);
    return ctx.measureText(t).width;
  };
  const fit = fitCaption(copy.headline, copy.subtitle, box, base, measureH, measureS, {
    scale: style.caption.scale,
  });
  const x = style.caption.align === "left" ? box.x : box.x + box.width / 2;
  let y = box.y + (box.height - fit.blockHeight) / 2;

  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = style.caption.align;
  ctx.textBaseline = "top";
  ctx.font = fontString(weight, fit.headlineSize, family);
  setTracking(ctx, -0.015, fit.headlineSize);
  for (const line of fit.headlineLines) {
    // Nudge down: canvas "top" baseline includes ascender padding.
    ctx.fillText(line, x, y + fit.headlineSize * 0.02);
    y += fit.lineHeight;
  }
  y += fit.gap;
  ctx.font = fontString(500, fit.subtitleSize, family);
  setTracking(ctx, 0, fit.subtitleSize);
  ctx.globalAlpha = 0.82;
  for (const line of fit.subtitleLines) {
    ctx.fillText(line, x, y);
    y += fit.subtitleLineHeight;
  }
  ctx.restore();
}

function drawDevice(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  rect: Box,
  rotation: number,
  opts: { card?: boolean; radius?: number; shadowScale?: number },
) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  if (rotation) ctx.rotate((rotation * Math.PI) / 180);
  const s = opts.shadowScale ?? 1;
  ctx.shadowColor = "rgba(0,0,0,0.38)";
  ctx.shadowBlur = rect.width * 0.06 * s;
  ctx.shadowOffsetY = rect.height * 0.018 * s;
  if (opts.card) {
    beginRoundedRect(ctx, -rect.width / 2, -rect.height / 2, rect.width, rect.height, opts.radius ?? 0);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.clip();
  }
  ctx.drawImage(img, -rect.width / 2, -rect.height / 2, rect.width, rect.height);
  ctx.restore();
}

export interface RenderedShot {
  canvas: HTMLCanvasElement;
  layout: SceneLayout | null;
}

export async function renderShot(input: ShotRenderInput): Promise<RenderedShot> {
  const scale = input.scale ?? 1;
  const W = Math.max(1, Math.round(input.size.width * scale));
  const H = Math.max(1, Math.round(input.size.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: scale === 1 });
  if (!ctx) throw new Error("Canvas 2D not available");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const { style, theme } = input;
  paintBackground(ctx, W, H, theme.background, input.backgroundImage);

  const device = await deviceAssetFor(input.size, input.primary, style);

  // Apple Watch: full-bleed screenshot, no frame or caption (Apple's guidance).
  if (device.kind === "watch") {
    drawImageInRect(ctx, input.primary, { x: 0, y: 0, width: W, height: H }, "cover");
    if (input.watermark) drawWatermark(ctx, W, H, undefined, scale);
    return { canvas, layout: null };
  }

  const layoutId = input.size.platform === "dual" ? "duo" : style.layout;
  const primaryImg: CanvasImageSource =
    device.kind === "frame" ? framed(input.primary, device.asset!) : input.primary;
  const pw = device.kind === "frame" ? (primaryImg as HTMLCanvasElement).width : input.primary.width;
  const ph = device.kind === "frame" ? (primaryImg as HTMLCanvasElement).height : input.primary.height;

  const hasCaption = Boolean(input.copy.headline.trim() || input.copy.subtitle.trim());
  const secondary = input.secondary && input.secondary !== input.primary ? input.secondary : null;
  const layout = computeLayout({
    width: W,
    height: H,
    layout: layoutId,
    deviceAspect: pw / ph,
    hasCaption,
    hasSecondary: Boolean(secondary),
    deviceScale: style.deviceScale,
  });

  // Soft glow behind the primary device.
  const primarySlot = layout.devices.find((d) => d.role === "primary")!;
  const primaryRect = placeInSlot(pw, ph, primarySlot);
  if (theme.glow) {
    const gx = primaryRect.x + primaryRect.width / 2;
    const gy = Math.min(H * 0.85, primaryRect.y + primaryRect.height * 0.4);
    const gr = Math.max(primaryRect.width, Math.min(primaryRect.height, H)) * 0.75;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    g.addColorStop(0, theme.glow);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  for (const slot of layout.devices) {
    const isPrimary = slot.role === "primary";
    const bitmap = isPrimary ? input.primary : secondary!;
    let img: CanvasImageSource = bitmap;
    let w = bitmap.width;
    let h = bitmap.height;
    if (device.kind === "frame") {
      // Secondary uses a bezel matching ITS orientation.
      const asset = isPrimary ? device.asset! : (await deviceAssetFor(input.size, bitmap, style)).asset;
      if (asset) {
        const f = framed(bitmap, asset);
        img = f;
        w = f.width;
        h = f.height;
      }
    }
    const rect = isPrimary ? primaryRect : placeInSlot(w, h, slot);
    drawDevice(ctx, img, rect, slot.rotation, {
      card: device.kind === "card",
      radius: Math.min(rect.width, rect.height) * 0.06,
      shadowScale: isPrimary ? 1 : 0.8,
    });
  }

  if (layout.caption) {
    const color = style.caption.color ?? theme.text;
    await ensureFont(style.caption.fontId, style.caption.weight, input.copy.headline);
    drawCaption(ctx, layout.caption, input.copy, style, color, layout.headlineBase);
  }

  if (input.watermark) drawWatermark(ctx, W, H, undefined, scale);
  return { canvas, layout };
}

/** ASC forbids alpha — encode as opaque 8-bit RGB PNG. */
export function canvasToOpaquePng(canvas: HTMLCanvasElement): Blob {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not available");
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i]!;
    rgb[j + 1] = data[i + 1]!;
    rgb[j + 2] = data[i + 2]!;
  }
  const encoded = encodePng({ width, height, data: rgb, channels: 3, depth: 8 });
  return new Blob([new Uint8Array(encoded)], { type: "image/png" });
}

export async function exportShot(input: Omit<ShotRenderInput, "scale">): Promise<Blob> {
  const { canvas } = await renderShot({ ...input, scale: 1 });
  return canvasToOpaquePng(canvas);
}

/** Sample a screenshot's pixels (downscaled) for the auto theme. */
export function samplePixels(bitmap: ImageBitmap, max = 96): Uint8ClampedArray {
  const s = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * s));
  const h = Math.max(1, Math.round(bitmap.height * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return new Uint8ClampedArray();
  ctx.drawImage(bitmap, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}
