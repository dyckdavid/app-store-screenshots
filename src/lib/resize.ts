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
  loadFrameAsset,
  framePrefetchKey,
  drawImageInRect,
} from "./frames";

export type FitMode = "contain" | "cover";

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
  drawImageInRect(
    ctx,
    source,
    { x: 0, y: 0, width, height },
    mode,
  );
}

export async function composeScreenshot(
  source: ImageBitmap,
  size: ScreenshotSize,
  options: FitMode | ComposeOptions,
): Promise<Blob> {
  const opts: Required<ComposeOptions> =
    typeof options === "string"
      ? { mode: options, background: DEFAULT_BACKGROUND, frames: false }
      : {
          mode: options.mode,
          background: options.background ?? DEFAULT_BACKGROUND,
          frames: options.frames ?? false,
        };

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D not available");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  fillBackground(ctx, size.width, size.height, opts.background);

  if (opts.frames) {
    if (size.platform === "watch") {
      drawWatchProceduralFrame(
        ctx,
        source,
        size.width,
        size.height,
        size.orientation,
        opts.mode,
      );
    } else {
      const asset = await loadFrameAsset(size);
      if (asset) {
        drawPngFrame(
          ctx,
          source,
          asset,
          size.width,
          size.height,
          opts.mode,
        );
      } else {
        drawPlain(ctx, source, size.width, size.height, opts.mode);
      }
    }
  } else {
    drawPlain(ctx, source, size.width, size.height, opts.mode);
  }

  return canvasToOpaquePngBlob(ctx, size.width, size.height);
}

export interface GenerateAllOptions {
  sources: SourceImage[];
  sizes: ScreenshotSize[];
  mode: FitMode;
  background?: Background;
  frames?: boolean;
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
    onProgress,
  } = options;

  const total = sources.length * sizes.length;
  let done = 0;
  const results: GeneratedResult[] = [];

  if (frames) {
    const unique = new Map<string, ScreenshotSize>();
    for (const size of sizes) {
      const key = framePrefetchKey(size);
      if (!unique.has(key)) unique.set(key, size);
    }
    await Promise.all(
      [...unique.values()].map((size) =>
        size.platform === "watch"
          ? Promise.resolve(null)
          : loadFrameAsset(size),
      ),
    );
  }

  for (const source of sources) {
    for (const size of sizes) {
      const blob = await composeScreenshot(source.bitmap, size, {
        mode,
        background,
        frames,
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
