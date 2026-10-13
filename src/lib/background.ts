/** Canvas background options for ASC screenshot exports. */

import { fittedImageRect } from "./geometry";

export type BackgroundKind = "solid" | "gradient" | "image";

export type GradientDirection =
  | "vertical"
  | "horizontal"
  | "diagonal-down"
  | "diagonal-up";

export interface SolidBackground {
  kind: "solid";
  color: string;
}

export interface GradientBackground {
  kind: "gradient";
  from: string;
  to: string;
  direction: GradientDirection;
}

export interface ImageBackground {
  kind: "image";
  /** data: URL or blob: URL usable by canvas drawImage */
  imageDataUrl: string;
  /** Solid underlay while the bitmap loads / behind transparent edges */
  fallbackColor: string;
}

export type Background =
  | SolidBackground
  | GradientBackground
  | ImageBackground;

export const SOLID_PRESETS: { label: string; color: string }[] = [
  { label: "Black", color: "#000000" },
  { label: "Near black", color: "#1d1d1f" },
  { label: "Slate", color: "#2c2c2e" },
  { label: "White", color: "#ffffff" },
  { label: "Soft gray", color: "#f5f5f7" },
  { label: "Blue", color: "#0071e3" },
];

export const GRADIENT_PRESETS: {
  label: string;
  from: string;
  to: string;
  direction: GradientDirection;
}[] = [
  {
    label: "Midnight",
    from: "#0b1020",
    to: "#1d1d1f",
    direction: "vertical",
  },
  {
    label: "Ocean",
    from: "#0071e3",
    to: "#001a33",
    direction: "diagonal-down",
  },
  {
    label: "Sunset",
    from: "#ff6b35",
    to: "#1d1d1f",
    direction: "vertical",
  },
  {
    label: "Mist",
    from: "#e8e8ed",
    to: "#f5f5f7",
    direction: "horizontal",
  },
];

export const DEFAULT_BACKGROUND: Background = {
  kind: "solid",
  color: "#000000",
};

export const GRADIENT_DIRECTIONS: {
  id: GradientDirection;
  label: string;
}[] = [
  { id: "vertical", label: "Vertical" },
  { id: "horizontal", label: "Horizontal" },
  { id: "diagonal-down", label: "Diagonal ↘" },
  { id: "diagonal-up", label: "Diagonal ↗" },
];

function gradientLine(
  direction: GradientDirection,
  width: number,
  height: number,
): [number, number, number, number] {
  switch (direction) {
    case "horizontal":
      return [0, 0, width, 0];
    case "diagonal-down":
      return [0, 0, width, height];
    case "diagonal-up":
      return [0, height, width, 0];
    default:
      return [0, 0, 0, height];
  }
}

export function fillBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: Background,
  imageBitmap?: CanvasImageSource | null,
): void {
  if (background.kind === "solid") {
    ctx.fillStyle = background.color;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (background.kind === "image") {
    ctx.fillStyle = background.fallbackColor || "#000000";
    ctx.fillRect(0, 0, width, height);
    if (imageBitmap) {
      const iw =
        "naturalWidth" in imageBitmap &&
        typeof imageBitmap.naturalWidth === "number" &&
        imageBitmap.naturalWidth > 0
          ? imageBitmap.naturalWidth
          : "width" in imageBitmap && typeof imageBitmap.width === "number"
            ? imageBitmap.width
            : width;
      const ih =
        "naturalHeight" in imageBitmap &&
        typeof imageBitmap.naturalHeight === "number" &&
        imageBitmap.naturalHeight > 0
          ? imageBitmap.naturalHeight
          : "height" in imageBitmap && typeof imageBitmap.height === "number"
            ? imageBitmap.height
            : height;
      const dest = fittedImageRect(
        iw,
        ih,
        { x: 0, y: 0, width, height },
        "cover",
      );
      ctx.drawImage(imageBitmap, dest.x, dest.y, dest.width, dest.height);
    }
    return;
  }
  const [x0, y0, x1, y1] = gradientLine(
    background.direction,
    width,
    height,
  );
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, background.from);
  gradient.addColorStop(1, background.to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function cssBackgroundPreview(background: Background): string {
  if (background.kind === "solid") return background.color;
  if (background.kind === "image") {
    return `center / cover no-repeat url("${background.imageDataUrl}"), ${background.fallbackColor}`;
  }
  const deg =
    background.direction === "horizontal"
      ? "90deg"
      : background.direction === "diagonal-down"
        ? "135deg"
        : background.direction === "diagonal-up"
          ? "45deg"
          : "180deg";
  return `linear-gradient(${deg}, ${background.from}, ${background.to})`;
}
