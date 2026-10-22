import type { Orientation, PlatformId, ScreenshotSize } from "./sizes";
import type { DeviceLayout } from "./design";
import { isFoldableLayout } from "./design";
import {
  fittedImageRect,
  framedDevicePlacement,
  type FitMode,
} from "./geometry";

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameTemplate {
  screen: ScreenRect;
  frameSize: { width: number; height: number };
}

export interface LoadedFrameAsset {
  key: string;
  frame: ImageBitmap;
  /** Alpha mask for destination-in (luminance already baked into alpha). */
  mask: ImageBitmap | null;
  template: FrameTemplate;
}

type CacheEntry = LoadedFrameAsset | Promise<LoadedFrameAsset>;

const cache = new Map<string, CacheEntry>();

/**
 * Upstream open-source PNG bezels (also vendored under public/frames/).
 * Production may load from these URLs when /frames/* is not on the CDN yet.
 */
const DFM =
  "https://raw.githubusercontent.com/jonnyjackson26/device-frames-media/main/device-frames-output";
const BGH =
  "https://raw.githubusercontent.com/bunlongheng/frames/main/public/assets/frames";

interface FrameRef {
  /** Prefer local public/ path first */
  localDir: string;
  frameFile: string;
  hasMask: boolean;
  rotateDeg: 0 | 90;
  /** Upstream fallbacks (raw GitHub) */
  remoteFrame: string;
  remoteMask?: string;
  template: FrameTemplate;
}

const IPHONE_TEMPLATE: FrameTemplate = {
  screen: { x: 100, y: 100, width: 1320, height: 2868 },
  frameSize: { width: 1520, height: 3068 },
};

const IPAD13_PORTRAIT: FrameTemplate = {
  screen: { x: 100, y: 100, width: 2064, height: 2752 },
  frameSize: { width: 2264, height: 2952 },
};

const IPAD13_LANDSCAPE: FrameTemplate = {
  screen: { x: 100, y: 100, width: 2752, height: 2064 },
  frameSize: { width: 2952, height: 2264 },
};

const IPAD11_PORTRAIT: FrameTemplate = {
  screen: { x: 99, y: 100, width: 1668, height: 2420 },
  frameSize: { width: 1868, height: 2620 },
};

const IPAD11_LANDSCAPE: FrameTemplate = {
  screen: { x: 100, y: 100, width: 2420, height: 1668 },
  frameSize: { width: 2620, height: 1868 },
};

const MAC_TEMPLATE: FrameTemplate = {
  screen: { x: 373, y: 123, width: 2560, height: 1600 },
  frameSize: { width: 3306, height: 1897 },
};

/** MIT iPhone Duo (foldable) from bunlongheng/frames — screen holes flood-filled. */
const DUO_CLOSED: FrameTemplate = {
  screen: { x: 88, y: 80, width: 1398, height: 2034 },
  frameSize: { width: 1574, height: 2194 },
};

const DUO_OPEN_PORTRAIT: FrameTemplate = {
  screen: { x: 120, y: 120, width: 2007, height: 2853 },
  frameSize: { width: 2247, height: 3093 },
};

const DUO_OPEN_LANDSCAPE: FrameTemplate = {
  screen: { x: 120, y: 120, width: 2853, height: 2007 },
  frameSize: { width: 3093, height: 2247 },
};

export type FoldablePose = "closed" | "open";

function resolveFoldableRef(
  pose: FoldablePose,
  orientation: Orientation,
): FrameRef {
  if (pose === "closed") {
    return {
      localDir: "/frames/iphone-duo/closed",
      frameFile: "frame.png",
      hasMask: false,
      rotateDeg: 0,
      remoteFrame: `${BGH}/iphone-duo-closed-portrait.png`,
      template: DUO_CLOSED,
    };
  }
  if (orientation === "landscape") {
    return {
      localDir: "/frames/iphone-duo/open-landscape",
      frameFile: "frame.png",
      hasMask: false,
      rotateDeg: 0,
      remoteFrame: `${BGH}/iphone-duo-open-landscape.png`,
      template: DUO_OPEN_LANDSCAPE,
    };
  }
  return {
    localDir: "/frames/iphone-duo/open-portrait",
    frameFile: "frame.png",
    hasMask: false,
    rotateDeg: 0,
    remoteFrame: `${BGH}/iphone-duo-open-portrait.png`,
    template: DUO_OPEN_PORTRAIT,
  };
}

function resolveFrameRef(size: ScreenshotSize): FrameRef | null {
  const { platform, orientation, id } = size;
  // Dual layouts and creative assets that need a phone use the iPhone bezel.
  if (platform === "iphone" || platform === "dual") {
    return {
      localDir: "/frames/iphone",
      frameFile: "frame.png",
      hasMask: true,
      rotateDeg: orientation === "landscape" ? 90 : 0,
      remoteFrame: `${DFM}/Apple%20iPhone/17%20Pro%20Max/Deep%20Blue/frame.png`,
      remoteMask: `${DFM}/Apple%20iPhone/17%20Pro%20Max/Deep%20Blue/mask.png`,
      template: IPHONE_TEMPLATE,
    };
  }
  if (platform === "ipad") {
    const is13 = id.includes("13");
    const landscape = orientation === "landscape";
    if (is13) {
      return landscape
        ? {
            localDir: "/frames/ipad-13/landscape",
            frameFile: "frame.png",
            hasMask: true,
            rotateDeg: 0,
            remoteFrame: `${DFM}/Apple%20iPad/iPad%20Pro%2013%20M4%20%26%20M5/Landscape%20-%20Space%20Black/frame.png`,
            remoteMask: `${DFM}/Apple%20iPad/iPad%20Pro%2013%20M4%20%26%20M5/Landscape%20-%20Space%20Black/mask.png`,
            template: IPAD13_LANDSCAPE,
          }
        : {
            localDir: "/frames/ipad-13/portrait",
            frameFile: "frame.png",
            hasMask: true,
            rotateDeg: 0,
            remoteFrame: `${DFM}/Apple%20iPad/iPad%20Pro%2013%20M4%20%26%20M5/Portrait%20-%20Space%20Black/frame.png`,
            remoteMask: `${DFM}/Apple%20iPad/iPad%20Pro%2013%20M4%20%26%20M5/Portrait%20-%20Space%20Black/mask.png`,
            template: IPAD13_PORTRAIT,
          };
    }
    return landscape
      ? {
          localDir: "/frames/ipad-11/landscape",
          frameFile: "frame.png",
          hasMask: true,
          rotateDeg: 0,
          remoteFrame: `${DFM}/Apple%20iPad/iPad%20Pro%2011%20M4%20%26%20M5/Landscape%20-%20Space%20Black/frame.png`,
          remoteMask: `${DFM}/Apple%20iPad/iPad%20Pro%2011%20M4%20%26%20M5/Landscape%20-%20Space%20Black/mask.png`,
          template: IPAD11_LANDSCAPE,
        }
      : {
          localDir: "/frames/ipad-11/portrait",
          frameFile: "frame.png",
          hasMask: true,
          rotateDeg: 0,
          remoteFrame: `${DFM}/Apple%20iPad/iPad%20Pro%2011%20M4%20%26%20M5/Portrait%20-%20Space%20Black/frame.png`,
          remoteMask: `${DFM}/Apple%20iPad/iPad%20Pro%2011%20M4%20%26%20M5/Portrait%20-%20Space%20Black/mask.png`,
          template: IPAD11_PORTRAIT,
        };
  }
  if (platform === "mac") {
    return {
      localDir: "/frames/mac",
      frameFile: "macbook.png",
      hasMask: false,
      rotateDeg: 0,
      remoteFrame: `${BGH}/macbook.png`,
      template: MAC_TEMPLATE,
    };
  }
  return null;
}

async function rotate90(bitmap: ImageBitmap): Promise<ImageBitmap> {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.height;
  canvas.height = bitmap.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not available");
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(bitmap, 0, 0);
  return createImageBitmap(canvas);
}

async function fetchBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return createImageBitmap(await res.blob());
}

async function loadLocalOrRemote(
  local: string,
  remote: string,
): Promise<ImageBitmap> {
  try {
    return await fetchBitmap(local);
  } catch {
    return fetchBitmap(remote);
  }
}

function rotateTemplate(template: FrameTemplate): FrameTemplate {
  const { frameSize, screen } = template;
  return {
    frameSize: { width: frameSize.height, height: frameSize.width },
    screen: {
      x: frameSize.height - screen.y - screen.height,
      y: screen.x,
      width: screen.height,
      height: screen.width,
    },
  };
}

/** Scale screen rect when the loaded PNG size differs from the template. */
function scaleTemplateToFrame(
  template: FrameTemplate,
  frameW: number,
  frameH: number,
): FrameTemplate {
  const { frameSize, screen } = template;
  if (frameSize.width === frameW && frameSize.height === frameH) {
    return { frameSize: { width: frameW, height: frameH }, screen: { ...screen } };
  }
  const sx = frameW / frameSize.width;
  const sy = frameH / frameSize.height;
  return {
    frameSize: { width: frameW, height: frameH },
    screen: {
      x: screen.x * sx,
      y: screen.y * sy,
      width: screen.width * sx,
      height: screen.height * sy,
    },
  };
}

/**
 * Convert a luminance screen mask to an alpha mask and return its opaque
 * bounding box (the screen hole). Canvas `destination-in` keys off alpha only.
 */
async function prepareMask(
  mask: ImageBitmap,
  fallback: ScreenRect,
): Promise<{ alphaMask: ImageBitmap; screen: ScreenRect }> {
  const width = mask.width;
  const height = mask.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { alphaMask: mask, screen: fallback };
  }
  ctx.drawImage(mask, 0, 0);
  const image = ctx.getImageData(0, 0, width, height);
  const { data } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = luminance;
      if (luminance > 128) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  const alphaMask = await createImageBitmap(canvas);
  const screen =
    maxX < minX || maxY < minY
      ? fallback
      : {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
        };
  return { alphaMask, screen };
}

async function loadFrameFromRef(ref: FrameRef): Promise<LoadedFrameAsset> {
  const key = `${ref.localDir}:${ref.frameFile}:${ref.rotateDeg}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const promise = (async (): Promise<LoadedFrameAsset> => {
    let frame = await loadLocalOrRemote(
      `${ref.localDir}/${ref.frameFile}`,
      ref.remoteFrame,
    );
    let mask: ImageBitmap | null = null;
    if (ref.hasMask && ref.remoteMask) {
      mask = await loadLocalOrRemote(
        `${ref.localDir}/mask.png`,
        ref.remoteMask,
      );
    }
    let template = ref.template;
    if (ref.rotateDeg === 90) {
      const rotatedFrame = await rotate90(frame);
      frame.close();
      frame = rotatedFrame;
      if (mask) {
        const rotatedMask = await rotate90(mask);
        mask.close();
        mask = rotatedMask;
      }
      template = rotateTemplate(ref.template);
    }
    template = scaleTemplateToFrame(template, frame.width, frame.height);
    if (mask) {
      const prepared = await prepareMask(mask, template.screen);
      if (prepared.alphaMask !== mask) mask.close();
      mask = prepared.alphaMask;
      template = { ...template, screen: prepared.screen };
    }
    const asset: LoadedFrameAsset = { key, frame, mask, template };
    cache.set(key, asset);
    return asset;
  })();

  cache.set(key, promise);
  try {
    return await promise;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
}

export async function loadFrameAsset(
  size: ScreenshotSize,
): Promise<LoadedFrameAsset | null> {
  const ref = resolveFrameRef(size);
  if (!ref) return null;
  return loadFrameFromRef(ref);
}

export async function loadFoldableFrameAsset(
  pose: FoldablePose,
  orientation: Orientation,
): Promise<LoadedFrameAsset> {
  return loadFrameFromRef(resolveFoldableRef(pose, orientation));
}

export function foldablePoseFromLayout(
  layout: DeviceLayout,
): FoldablePose | null {
  if (layout === "foldable-closed") return "closed";
  if (layout === "foldable-open") return "open";
  return null;
}

export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function beginRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.beginPath();
  roundedRectPath(ctx, x, y, w, h, radius);
}

export function drawImageInRect(
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap,
  rect: ScreenRect,
  mode: FitMode,
): void {
  const dest = fittedImageRect(image.width, image.height, rect, mode);
  ctx.drawImage(image, dest.x, dest.y, dest.width, dest.height);
}

/**
 * Build an offscreen canvas with the screenshot cover-filled into the device
 * screen/mask, then the PNG bezel drawn on top. Does NOT scale to ASC size.
 */
export function renderFramedDevice(
  source: ImageBitmap,
  asset: LoadedFrameAsset,
): HTMLCanvasElement {
  const { frame, mask, template } = asset;
  const fw = template.frameSize.width;
  const fh = template.frameSize.height;
  const screen = template.screen;

  const off = document.createElement("canvas");
  off.width = fw;
  off.height = fh;
  const offCtx = off.getContext("2d");
  if (!offCtx) throw new Error("Canvas 2D not available");

  // Step 1: always cover-fill the screen geometry (no in-screen letterboxing).
  offCtx.save();
  if (mask) {
    drawImageInRect(offCtx, source, screen, "cover");
    offCtx.globalCompositeOperation = "destination-in";
    offCtx.drawImage(mask, 0, 0, fw, fh);
    offCtx.globalCompositeOperation = "source-over";
  } else {
    offCtx.beginPath();
    const corner = 0.02 * Math.min(screen.width, screen.height);
    roundedRectPath(
      offCtx,
      screen.x,
      screen.y,
      screen.width,
      screen.height,
      corner,
    );
    offCtx.clip();
    drawImageInRect(offCtx, source, screen, "cover");
  }
  offCtx.restore();
  offCtx.drawImage(frame, 0, 0, fw, fh);
  return off;
}

/**
 * Framed compose (David’s rule):
 * 1. Cover-fill the screenshot into the device screen hole (never letterbox
 *    inside the screen — crop overflow instead).
 * 2. Scale the whole framed device into the ASC canvas using `mode`
 *    (contain = fit device with background around it; cover = fill canvas).
 */
export function drawPngFrame(
  ctx: CanvasRenderingContext2D,
  source: ImageBitmap,
  asset: LoadedFrameAsset,
  canvasW: number,
  canvasH: number,
  mode: FitMode,
): void {
  const off = renderFramedDevice(source, asset);
  const fw = off.width;
  const fh = off.height;
  const place = framedDevicePlacement(fw, fh, canvasW, canvasH, mode);
  ctx.drawImage(off, place.x, place.y, place.width, place.height);
}

export interface DualSources {
  primary: ImageBitmap;
  secondary: ImageBitmap;
}

/**
 * Draw two framed iPhones onto one ASC canvas.
 * Variants: side-by-side, overlapping, or angled.
 * Works for every iPhone ASC size (6.9" → 6.1", portrait + landscape).
 */
export function drawDualIphones(
  ctx: CanvasRenderingContext2D,
  sources: DualSources,
  asset: LoadedFrameAsset,
  canvasW: number,
  canvasH: number,
  layout: "dual-side" | "dual-overlap" | "dual-angled",
): void {
  const left = renderFramedDevice(sources.primary, asset);
  const right = renderFramedDevice(sources.secondary, asset);
  const portrait = canvasH >= canvasW;

  if (layout === "dual-side") {
    const gap = Math.min(canvasW, canvasH) * (portrait ? 0.028 : 0.035);
    const maxDeviceW = (canvasW - gap) / 2;
    const maxDeviceH = canvasH * (portrait ? 0.76 : 0.9);
    const scale = Math.min(maxDeviceW / left.width, maxDeviceH / left.height);
    const dw = left.width * scale;
    const dh = left.height * scale;
    const totalW = dw * 2 + gap;
    const x0 = (canvasW - totalW) / 2;
    const y = (canvasH - dh) / 2 + (portrait ? canvasH * 0.045 : 0);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = dw * 0.04;
    ctx.shadowOffsetY = dh * 0.015;
    ctx.drawImage(left, x0, y, dw, dh);
    ctx.drawImage(right, x0 + dw + gap, y, dw, dh);
    ctx.restore();
    return;
  }

  if (layout === "dual-overlap") {
    const targetH = portrait ? canvasH * 0.68 : canvasH * 0.86;
    const scale = targetH / left.height;
    const dw = left.width * scale;
    const dh = left.height * scale;
    const overlap = dw * (portrait ? 0.4 : 0.34);
    const totalW = dw * 2 - overlap;
    const x0 = (canvasW - totalW) / 2;
    const y = (canvasH - dh) / 2 + (portrait ? canvasH * 0.035 : 0);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.38)";
    ctx.shadowBlur = dw * 0.07;
    ctx.shadowOffsetY = dh * 0.025;
    ctx.drawImage(left, x0, y + dh * 0.05, dw, dh);
    ctx.drawImage(right, x0 + dw - overlap, y - dh * 0.03, dw, dh);
    ctx.restore();
    return;
  }

  // dual-angled (tilted pair)
  const targetH = portrait ? canvasH * 0.6 : canvasH * 0.8;
  const scale = targetH / left.height;
  const dw = left.width * scale;
  const dh = left.height * scale;
  const cx = canvasW / 2;
  const cy = canvasH / 2 + (portrait ? canvasH * 0.05 : 0);
  const spread = portrait ? 0.3 : 0.34;
  const tilt = portrait ? 9 : 7;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = dw * 0.05;
  ctx.translate(cx - dw * spread, cy);
  ctx.rotate((-tilt * Math.PI) / 180);
  ctx.drawImage(left, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = dw * 0.05;
  ctx.translate(cx + dw * spread, cy);
  ctx.rotate((tilt * Math.PI) / 180);
  ctx.drawImage(right, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

/**
 * Cover-fill into foldable bezel, then scale framed device to ASC canvas.
 * Same two-step rule as PNG iPhone/iPad frames.
 */
export function drawFoldableDevice(
  ctx: CanvasRenderingContext2D,
  source: ImageBitmap,
  asset: LoadedFrameAsset,
  canvasW: number,
  canvasH: number,
  mode: FitMode,
): void {
  drawPngFrame(ctx, source, asset, canvasW, canvasH, mode);
}

export { isFoldableLayout };

export function drawWatchProceduralFrame(
  ctx: CanvasRenderingContext2D,
  source: ImageBitmap,
  canvasW: number,
  canvasH: number,
  orientation: Orientation,
  mode: FitMode,
): void {
  const aspect =
    orientation === "landscape" ? 1.1627906976744187 : 0.86;
  // Reference device size; then fit into ASC canvas via contain/cover.
  const refH = 1000;
  const refW = refH * aspect;
  const fitScale =
    mode === "contain"
      ? Math.min(canvasW / refW, canvasH / refH)
      : Math.max(canvasW / refW, canvasH / refH);
  const deviceW = refW * fitScale;
  const deviceH = refH * fitScale;
  const deviceX = (canvasW - deviceW) / 2;
  const deviceY = (canvasH - deviceH) / 2;
  const inset = 0.09 * Math.min(deviceW, deviceH);
  const screen = {
    x: deviceX + inset,
    y: deviceY + inset,
    width: deviceW - 2 * inset,
    height: deviceH - 2 * inset,
  };
  const outerRadius = 0.28 * Math.min(deviceW, deviceH);
  const screenRadius = 0.22 * Math.min(deviceW, deviceH);
  const v = Math.min(deviceW, deviceH);

  ctx.save();
  beginRoundedRect(
    ctx,
    deviceX,
    deviceY,
    deviceW,
    deviceH,
    outerRadius,
  );
  const bezel = ctx.createLinearGradient(
    deviceX,
    deviceY,
    deviceX + deviceW,
    deviceY + deviceH,
  );
  bezel.addColorStop(0, "#3a3a3c");
  bezel.addColorStop(0.5, "#1c1c1e");
  bezel.addColorStop(1, "#0a0a0a");
  ctx.fillStyle = bezel;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = Math.max(1, 0.004 * v);
  ctx.stroke();
  beginRoundedRect(
    ctx,
    screen.x,
    screen.y,
    screen.width,
    screen.height,
    screenRadius,
  );
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();

  ctx.save();
  beginRoundedRect(
    ctx,
    screen.x,
    screen.y,
    screen.width,
    screen.height,
    screenRadius,
  );
  ctx.clip();
  // Always cover-fill the watch face (same rule as PNG frames).
  drawImageInRect(ctx, source, screen, "cover");
  ctx.restore();

  // Digital Crown
  ctx.save();
  const crownW = 0.045 * v;
  const crownH = 0.14 * v;
  if (orientation === "landscape") {
    beginRoundedRect(
      ctx,
      deviceX + deviceW / 2 - crownH / 2,
      deviceY + deviceH - 0.35 * crownW,
      crownH,
      crownW,
      crownW / 2,
    );
  } else {
    beginRoundedRect(
      ctx,
      deviceX + deviceW - 0.35 * crownW,
      deviceY + 0.28 * deviceH,
      crownW,
      crownH,
      crownW / 2,
    );
  }
  ctx.fillStyle = "#4a4a4c";
  ctx.fill();
  ctx.restore();
}

/** Prefetch key used when generating many sizes sharing one frame. */
export function framePrefetchKey(size: ScreenshotSize): string {
  const platform =
    size.platform === "dual" || size.platform === "header" || size.platform === "search"
      ? "iphone"
      : size.platform;
  return `${platform}-${size.orientation}-${
    size.id.includes("13") ? "13" : size.id.includes("11") ? "11" : "x"
  }`;
}

/** Portrait iPhone size used to load a bezel for header/search compositions. */
export function iphoneFrameProbeSize(): ScreenshotSize {
  return {
    id: "iphone-69-portrait",
    platform: "iphone",
    displayName: 'iPhone 6.9" Display',
    width: 1320,
    height: 2868,
    orientation: "portrait",
  };
}

export type { PlatformId };
