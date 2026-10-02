import type { Orientation, PlatformId, ScreenshotSize } from "./sizes";

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

function resolveFrameRef(size: ScreenshotSize): FrameRef | null {
  const { platform, orientation, id } = size;
  if (platform === "iphone") {
    return {
      localDir: "/frames/iphone",
      frameFile: "frame.png",
      hasMask: true,
      rotateDeg: orientation === "landscape" ? 90 : 0,
      remoteFrame: `${DFM}/Apple%20iPhone/16%20Pro%20Max/Black%20Titanium/frame.png`,
      remoteMask: `${DFM}/Apple%20iPhone/16%20Pro%20Max/Black%20Titanium/mask.png`,
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

export async function loadFrameAsset(
  size: ScreenshotSize,
): Promise<LoadedFrameAsset | null> {
  const ref = resolveFrameRef(size);
  if (!ref) return null;

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
    template = {
      ...template,
      frameSize: { width: frame.width, height: frame.height },
    };
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
  mode: "contain" | "cover",
): void {
  const iw = image.width;
  const ih = image.height;
  const scale =
    mode === "contain"
      ? Math.min(rect.width / iw, rect.height / ih)
      : Math.max(rect.width / iw, rect.height / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + (rect.width - dw) / 2;
  const dy = rect.y + (rect.height - dh) / 2;
  ctx.drawImage(image, dx, dy, dw, dh);
}

export function drawPngFrame(
  ctx: CanvasRenderingContext2D,
  source: ImageBitmap,
  asset: LoadedFrameAsset,
  canvasW: number,
  canvasH: number,
  mode: "contain" | "cover",
): void {
  const { frame, mask, template } = asset;
  const fw = template.frameSize.width;
  const fh = template.frameSize.height;
  const screen = template.screen;
  const scale = Math.min((0.9 * canvasW) / fw, (0.9 * canvasH) / fh);
  const dw = fw * scale;
  const dh = fh * scale;

  const off = document.createElement("canvas");
  off.width = fw;
  off.height = fh;
  const offCtx = off.getContext("2d");
  if (!offCtx) throw new Error("Canvas 2D not available");

  offCtx.save();
  if (mask) {
    drawImageInRect(offCtx, source, screen, mode);
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
    drawImageInRect(offCtx, source, screen, mode);
  }
  offCtx.restore();
  offCtx.drawImage(frame, 0, 0, fw, fh);
  ctx.drawImage(off, (canvasW - dw) / 2, (canvasH - dh) / 2, dw, dh);
}

export function drawWatchProceduralFrame(
  ctx: CanvasRenderingContext2D,
  source: ImageBitmap,
  canvasW: number,
  canvasH: number,
  orientation: Orientation,
  mode: "contain" | "cover",
): void {
  const aspect =
    orientation === "landscape" ? 1.1627906976744187 : 0.86;
  let deviceW: number;
  let deviceH: number;
  const maxW = 0.78 * canvasW;
  const maxH = 0.78 * canvasH;
  if (maxW / maxH > aspect) {
    deviceH = maxH;
    deviceW = deviceH * aspect;
  } else {
    deviceW = maxW;
    deviceH = deviceW / aspect;
  }
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
  drawImageInRect(ctx, source, screen, mode);
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
  return `${size.platform}-${size.orientation}-${
    size.id.includes("13") ? "13" : size.id.includes("11") ? "11" : "x"
  }`;
}

export type { PlatformId };
