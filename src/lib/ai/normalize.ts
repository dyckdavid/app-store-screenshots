import type { DeviceLayout, TextAlign, TextPosition } from "@/lib/design";
import type { GradientDirection } from "@/lib/background";
import type {
  ScreenshotAiSuggestions,
  SuggestedBackground,
  SuggestedDevice,
} from "./types";

export function normalizeSuggestions(
  raw: Partial<ScreenshotAiSuggestions> & Record<string, unknown>,
): ScreenshotAiSuggestions {
  return {
    headline: clampStr(raw.headline, 48) || "Meet your next favorite app",
    subtitle: clampStr(raw.subtitle, 64),
    layout: asLayout(raw.layout),
    device: asDevice(raw.device),
    backgroundStyle: asBackground(raw.backgroundStyle),
    colorPalette: {
      text: asHex(
        (raw.colorPalette as Record<string, unknown> | undefined)?.text,
        "#ffffff",
      ),
      background: asHex(
        (raw.colorPalette as Record<string, unknown> | undefined)?.background,
        "#0a0f14",
      ),
      accent: asHex(
        (raw.colorPalette as Record<string, unknown> | undefined)?.accent,
        "#0f766e",
      ),
    },
    textAlign: asAlign(raw.textAlign),
    textPosition: asPosition(raw.textPosition),
    rationale: clampStr(raw.rationale, 160),
  };
}

function clampStr(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function asHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(v) ? v : fallback;
}

function asLayout(value: unknown): DeviceLayout {
  const allowed: DeviceLayout[] = [
    "single",
    "dual-side",
    "dual-overlap",
    "dual-angled",
    "foldable-closed",
    "foldable-open",
  ];
  return allowed.includes(value as DeviceLayout)
    ? (value as DeviceLayout)
    : "single";
}

function asDevice(value: unknown): SuggestedDevice {
  const allowed: SuggestedDevice[] = [
    "iphone",
    "ipad",
    "mac",
    "watch",
    "dual",
    "header",
    "search",
    "foldable",
  ];
  return allowed.includes(value as SuggestedDevice)
    ? (value as SuggestedDevice)
    : "iphone";
}

function asAlign(value: unknown): TextAlign {
  const allowed: TextAlign[] = ["left", "center", "right"];
  return allowed.includes(value as TextAlign) ? (value as TextAlign) : "center";
}

function asPosition(value: unknown): TextPosition {
  return value === "bottom" ? "bottom" : "top";
}

function asBackground(value: unknown): SuggestedBackground {
  if (!value || typeof value !== "object") {
    return { kind: "solid", color: "#0a0f14" };
  }
  const o = value as Record<string, unknown>;
  if (o.kind === "gradient") {
    const dirs: GradientDirection[] = [
      "vertical",
      "horizontal",
      "diagonal-down",
      "diagonal-up",
    ];
    const direction = dirs.includes(o.direction as GradientDirection)
      ? (o.direction as GradientDirection)
      : "vertical";
    return {
      kind: "gradient",
      from: asHex(o.from, "#0b3d3a"),
      to: asHex(o.to, "#0a0f14"),
      direction,
    };
  }
  return { kind: "solid", color: asHex(o.color, "#0a0f14") };
}
