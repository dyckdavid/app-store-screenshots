import { encode as encodePng } from "fast-png";
import type { ScreenshotSize } from "./sizes";
import { fileStem } from "./sizes";
import {
  fillBackground,
  type Background,
  DEFAULT_BACKGROUND,
} from "./background";
import {
  drawPngFrame,
  drawWatchProceduralFrame,
  drawDualIphones,
  loadFrameAsset,
  framePrefetchKey,
  drawImageInRect,
  iphoneFrameProbeSize,
} from "./frames";
import type { DesignState, DeviceLayout } from "./design";
import { DEFAULT_DESIGN } from "./design";
import { drawTextOverlay, drawGuides } from "./text-overlay";
import { ensureFontsReady } from "./fonts";
import type { FitMode } from "./geometry";

export type { FitMode };

export interface SourceImage {
  id: string;
  file: File;
  name: string;
  bitmap: ImageBitmap;
  previewUrl: string;
}

export interface GeneratedResult {
  id: string;
  sourceId: string;
  sourceName: string;
  size: ScreenshotSize;
  blob: Blob;
  previewUrl: string;
  filename: string;
}

export interface ComposeOptions {
  mode: FitMode;
  background?: Background;
  /** When true, wrap the screenshot in a device bezel (PNG where available). */
  frames?: boolean;
  design?: DesignState;
  /** Second source for dual-device layouts / sets. */
  secondary?: ImageBitmap | null;
  /** Draw snap/alignment guides (preview only; never in exports). */
  guides?: boolean;
}

export async function loadSourceImage(file: File): Promise<SourceImage> {
  const bitmap = await createImageBitmap(file);
  const previewUrl = URL.createObjectURL(file);
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    name: file.name,
    bitmap,
    previewUrl,
  };
}

/** Canvas PNG is always RGBA; ASC forbids alpha — encode opaque RGB. */
function canvasToOpaquePngBlob(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): Blob {
  const { data } = ctx.getImageData(0, 0, width, height);
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }
  const encoded = encodePng({
    width,
    height,
    data: rgb,
    channels: 3,
    depth: 8,
  });
  return new Blob([new Uint8Array(encoded)], { type: "image/png" });
}

function drawPlain(
  ctx: CanvasRenderingContext2D,
  source: ImageBitmap,
  width: number,
  height: number,
  mode: FitMode,
): void {
  drawImageInRect(ctx, source, { x: 0, y: 0, width, height }, mode);
}

function effectiveLayout(
  size: ScreenshotSize,
  layout: DeviceLayout,
): DeviceLayout {
  if (size.platform === "dual") {
    return layout === "single" ? "dual-side" : layout;
  }
  if (layout !== "single" && (size.platform === "header" || size.platform === "search")) {
    return layout;
  }
  if (layout !== "single" && size.platform === "iphone") {
    return layout;
  }
  return "single";
}

export async function composeScreenshot(
  source: ImageBitmap,
  size: ScreenshotSize,
  options: FitMode | ComposeOptions,
): Promise<Blob> {
  const canvas = await composeToCanvas(source, size, options, false);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D not available");
  return canvasToOpaquePngBlob(ctx, size.width, size.height);
}

/** Compose onto a canvas for live preview or export. */
export async function composeToCanvas(
  source: ImageBitmap,
  size: ScreenshotSize,
  options: FitMode | ComposeOptions,
  forPreview: boolean,
): Promise<HTMLCanvasElement> {
  const opts: Required<
    Omit<ComposeOptions, "secondary" | "design" | "guides">
  > & {
    secondary: ImageBitmap | null;
    design: DesignState;
    guides: boolean;
  } =
    typeof options === "string"
      ? {
          mode: options,
          background: DEFAULT_BACKGROUND,
          frames: false,
          secondary: null,
          design: DEFAULT_DESIGN,
          guides: false,
        }
      : {
          mode: options.mode,
          background: options.background ?? options.design?.background ?? DEFAULT_BACKGROUND,
          frames: options.frames ?? options.design?.frames ?? false,
          secondary: options.secondary ?? null,
          design: options.design ?? DEFAULT_DESIGN,
          guides: options.guides ?? false,
        };

  const design = opts.design;
  const background = design.background ?? opts.background;
  const frames = design.frames ?? opts.frames;
  const mode = design.mode ?? opts.mode;

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D not available");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  fillBackground(ctx, size.width, size.height, background);

  await ensureFontsReady();

  const layout = effectiveLayout(size, design.layout);
  const secondary = opts.secondary ?? source;

  if (layout !== "single" && frames) {
    const asset =
      size.platform === "header" || size.platform === "search"
        ? await loadFrameAsset(iphoneFrameProbeSize())
        : await loadFrameAsset(
            size.platform === "dual" || size.platform === "iphone"
              ? size
              : iphoneFrameProbeSize(),
          );
    if (asset) {
      drawDualIphones(
        ctx,
        { primary: source, secondary },
        asset,
        size.width,
        size.height,
        layout,
      );
    } else {
      drawPlain(ctx, source, size.width, size.height, mode);
    }
  } else if (frames) {
    if (size.platform === "watch") {
      drawWatchProceduralFrame(
        ctx,
        source,
        size.width,
        size.height,
        size.orientation,
        mode,
      );
    } else if (size.platform === "header" || size.platform === "search") {
      const asset = await loadFrameAsset(iphoneFrameProbeSize());
      if (asset) {
        drawPngFrame(ctx, source, asset, size.width, size.height, mode);
      } else {
        drawPlain(ctx, source, size.width, size.height, mode);
      }
    } else {
      const asset = await loadFrameAsset(size);
      if (asset) {
        drawPngFrame(ctx, source, asset, size.width, size.height, mode);
      } else {
        drawPlain(ctx, source, size.width, size.height, mode);
      }
    }
  } else {
    drawPlain(ctx, source, size.width, size.height, mode);
  }

  drawTextOverlay(ctx, size.width, size.height, design.text);

  if (forPreview && opts.guides && design.showGuides) {
    drawGuides(ctx, size.width, size.height, design.text.insetPercent);
  }

  return canvas;
}

export interface GenerateAllOptions {
  sources: SourceImage[];
  sizes: ScreenshotSize[];
  mode: FitMode;
  background?: Background;
  frames?: boolean;
  design?: DesignState;
  onProgress?: (done: number, total: number) => void;
}

export async function generateAll(
  options: GenerateAllOptions,
): Promise<GeneratedResult[]> {
  const {
    sources,
    sizes,
    mode,
    background = DEFAULT_BACKGROUND,
    frames = false,
    design = DEFAULT_DESIGN,
    onProgress,
  } = options;

  const total = sources.length * sizes.length;
  let done = 0;
  const results: GeneratedResult[] = [];

  if (frames || design.frames) {
    const unique = new Map<string, ScreenshotSize>();
    for (const size of sizes) {
      const probe =
        size.platform === "header" || size.platform === "search"
          ? iphoneFrameProbeSize()
          : size;
      const key = framePrefetchKey(probe);
      if (!unique.has(key)) unique.set(key, probe);
    }
    await Promise.all(
      [...unique.values()].map((size) =>
        size.platform === "watch"
          ? Promise.resolve(null)
          : loadFrameAsset(size),
      ),
    );
  }

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]!;
    const secondary = sources[(i + 1) % sources.length]!;
    for (const size of sizes) {
      const blob = await composeScreenshot(source.bitmap, size, {
        mode: design.mode ?? mode,
        background: design.background ?? background,
        frames: design.frames ?? frames,
        design,
        secondary: secondary.bitmap,
        guides: false,
      });
      const filename = `${fileStem(size, source.name)}.png`;
      const previewUrl = URL.createObjectURL(blob);
      results.push({
        id: `${source.id}-${size.id}`,
        sourceId: source.id,
        sourceName: source.name,
        size,
        blob,
        previewUrl,
        filename,
      });
      done += 1;
      onProgress?.(done, total);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return results;
}

export function revokeSource(source: SourceImage): void {
  source.bitmap.close();
  URL.revokeObjectURL(source.previewUrl);
}

export function revokeResults(results: GeneratedResult[]): void {
  for (const result of results) URL.revokeObjectURL(result.previewUrl);
}
