/** Pure geometry helpers for screenshot → rect placement (testable without canvas). */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FitMode = "contain" | "cover";

/**
 * Compute destination rect for an image placed into `rect` with contain/cover.
 * Cover never letterboxes — it crops overflow. Contain may leave empty margins.
 */
export function fittedImageRect(
  imageW: number,
  imageH: number,
  rect: Rect,
  mode: FitMode,
): Rect {
  const scale =
    mode === "contain"
      ? Math.min(rect.width / imageW, rect.height / imageH)
      : Math.max(rect.width / imageW, rect.height / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

/**
 * Scale a framed device (fw×fh) onto an ASC canvas (canvasW×canvasH).
 * Used after the screenshot has already been cover-filled into the screen hole.
 */
export function framedDevicePlacement(
  frameW: number,
  frameH: number,
  canvasW: number,
  canvasH: number,
  mode: FitMode,
): Rect {
  const scale =
    mode === "contain"
      ? Math.min(canvasW / frameW, canvasH / frameH)
      : Math.max(canvasW / frameW, canvasH / frameH);
  const width = frameW * scale;
  const height = frameH * scale;
  return {
    x: (canvasW - width) / 2,
    y: (canvasH - height) / 2,
    width,
    height,
  };
}

/** True when cover-fill of image into screen would crop (no letterboxing). */
export function coverFillsWithoutLetterbox(
  imageW: number,
  imageH: number,
  screen: Rect,
): boolean {
  const fitted = fittedImageRect(imageW, imageH, screen, "cover");
  return (
    fitted.width >= screen.width - 0.5 && fitted.height >= screen.height - 0.5
  );
}
