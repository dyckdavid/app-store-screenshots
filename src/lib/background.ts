/** Canvas background options for ASC screenshot exports. */

export type BackgroundKind = "solid" | "gradient";

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

export type Background = SolidBackground | GradientBackground;

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
): void {
  if (background.kind === "solid") {
    ctx.fillStyle = background.color;
    ctx.fillRect(0, 0, width, height);
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
