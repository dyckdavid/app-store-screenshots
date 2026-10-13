/** Placeable decorative graphic layers for ASC compositions. */

export interface GraphicLayer {
  id: string;
  imageDataUrl: string;
  /** Center X as % of canvas width (0–100). */
  xPercent: number;
  /** Center Y as % of canvas height (0–100). */
  yPercent: number;
  /** Layer width as % of canvas width (5–80). */
  widthPercent: number;
  opacity: number;
}

const bitmapCache = new Map<string, Promise<ImageBitmap | null>>();

export function createGraphicLayer(imageDataUrl: string): GraphicLayer {
  return {
    id: `gfx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    imageDataUrl,
    xPercent: 82,
    yPercent: 18,
    widthPercent: 28,
    opacity: 0.9,
  };
}

export async function loadImageSource(
  imageDataUrl: string,
): Promise<ImageBitmap | null> {
  if (!imageDataUrl) return null;
  let pending = bitmapCache.get(imageDataUrl);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(imageDataUrl);
        const blob = await res.blob();
        return await createImageBitmap(blob);
      } catch {
        bitmapCache.delete(imageDataUrl);
        return null;
      }
    })();
    bitmapCache.set(imageDataUrl, pending);
  }
  return pending;
}

export async function drawGraphicLayers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layers: GraphicLayer[],
): Promise<void> {
  if (!layers.length) return;
  for (const layer of layers) {
    const bitmap = await loadImageSource(layer.imageDataUrl);
    if (!bitmap) continue;
    const drawW = (Math.max(5, Math.min(80, layer.widthPercent)) / 100) * width;
    const aspect = bitmap.height / Math.max(1, bitmap.width);
    const drawH = drawW * aspect;
    const cx = (layer.xPercent / 100) * width;
    const cy = (layer.yPercent / 100) * height;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
    ctx.drawImage(bitmap, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
    ctx.restore();
  }
}
