/**
 * Studio data model. A project = ordered shots (each with its own caption)
 * + one shared style. Pure types/defaults only.
 */
import { WHITE, contrastRatio, dominantColor, hslToHex, hexToRgb, pickTextColor, rgbToHsl } from "./color";

export type LayoutId = "hero" | "classic" | "caption-bottom" | "tilt" | "duo" | "frameless";

export interface LayoutOption {
  id: LayoutId;
  label: string;
  hint: string;
}

export const LAYOUTS: LayoutOption[] = [
  { id: "hero", label: "Hero", hint: "Big caption, phone rises from the bottom edge" },
  { id: "classic", label: "Classic", hint: "Caption above a fully visible device" },
  { id: "caption-bottom", label: "Caption below", hint: "Device hangs from the top, caption underneath" },
  { id: "tilt", label: "Tilted", hint: "Device angled for energy" },
  { id: "duo", label: "Duo", hint: "This shot in front, the next one behind" },
  { id: "frameless", label: "Frameless", hint: "Rounded screenshot card, no bezel" },
];

export type Background =
  | { kind: "solid"; color: string }
  | { kind: "linear"; from: string; to: string; angle: number }
  | { kind: "mesh"; base: string; blobs: { x: number; y: number; r: number; color: string }[] }
  | { kind: "image"; dataUrl: string; dim: number };

export interface Theme {
  id: string;
  label: string;
  background: Background;
  text: string;
  /** Soft light behind the device. */
  glow: string | null;
}

export const THEMES: Theme[] = [
  {
    id: "midnight",
    label: "Midnight",
    background: {
      kind: "mesh",
      base: "#0b1023",
      blobs: [
        { x: 0.15, y: 0.1, r: 0.7, color: "#3b2f8f" },
        { x: 0.95, y: 0.55, r: 0.6, color: "#1d4ed8" },
        { x: 0.3, y: 1, r: 0.6, color: "#6d28d9" },
      ],
    },
    text: "#ffffff",
    glow: "rgba(129,140,248,0.35)",
  },
  {
    id: "ocean",
    label: "Ocean",
    background: { kind: "linear", from: "#0284c7", to: "#1e3a8a", angle: 160 },
    text: "#ffffff",
    glow: "rgba(186,230,253,0.35)",
  },
  {
    id: "sunset",
    label: "Sunset",
    background: { kind: "linear", from: "#e11d48", to: "#ea580c", angle: 150 },
    text: "#ffffff",
    glow: "rgba(255,237,213,0.4)",
  },
  {
    id: "grape",
    label: "Grape",
    background: {
      kind: "mesh",
      base: "#4c1d95",
      blobs: [
        { x: 0, y: 0, r: 0.8, color: "#7c3aed" },
        { x: 1, y: 0.7, r: 0.7, color: "#db2777" },
      ],
    },
    text: "#ffffff",
    glow: "rgba(244,114,182,0.3)",
  },
  {
    id: "forest",
    label: "Forest",
    background: { kind: "linear", from: "#047857", to: "#022c22", angle: 170 },
    text: "#ffffff",
    glow: "rgba(167,243,208,0.3)",
  },
  {
    id: "graphite",
    label: "Graphite",
    background: { kind: "linear", from: "#2c2c2e", to: "#000000", angle: 180 },
    text: "#ffffff",
    glow: "rgba(255,255,255,0.12)",
  },
  {
    id: "paper",
    label: "Paper",
    background: { kind: "solid", color: "#f2f2f7" },
    text: "#0b0d12",
    glow: null,
  },
  {
    id: "mint",
    label: "Mint",
    background: { kind: "linear", from: "#ecfdf5", to: "#a7f3d0", angle: 180 },
    text: "#064e3b",
    glow: "rgba(255,255,255,0.6)",
  },
  {
    id: "peach",
    label: "Peach",
    background: { kind: "linear", from: "#fff7ed", to: "#fed7aa", angle: 180 },
    text: "#431407",
    glow: "rgba(255,255,255,0.6)",
  },
];

export const AUTO_THEME_ID = "auto";
export const CUSTOM_THEME_ID = "custom";

/** Build a polished theme around one brand color (e.g. from a screenshot). */
export function themeFromColor(hex: string, id = AUTO_THEME_ID, label = "From your app"): Theme {
  const { h, s } = rgbToHsl(hexToRgb(hex));
  const sat = Math.max(0.45, Math.min(0.85, s));
  // Lighten as much as possible while white text stays readable (≥ 3.2:1).
  const readable = (l: number) => contrastRatio(WHITE, hslToHex(h, sat, l)) >= 3.2;
  let topL = 0.55;
  while (topL > 0.2 && !readable(topL)) topL -= 0.02;
  let accentL = 0.58;
  while (accentL > 0.2 && !readable(accentL)) accentL -= 0.02;
  const top = hslToHex(h, sat, topL);
  const bottom = hslToHex(h + 18, Math.min(1, sat + 0.05), Math.min(0.24, topL - 0.12));
  const accent = hslToHex(h - 25, sat, accentL);
  return {
    id,
    label,
    background: {
      kind: "mesh",
      base: bottom,
      blobs: [
        { x: 0.2, y: 0, r: 0.9, color: top },
        { x: 1, y: 0.75, r: 0.6, color: accent },
      ],
    },
    text: WHITE,
    glow: "rgba(255,255,255,0.22)",
  };
}

export function themeFromPixels(data: ArrayLike<number>): Theme {
  return themeFromColor(dominantColor(data));
}

/** Two-color custom theme from the user's picks. */
export function customTheme(from: string, to: string): Theme {
  return {
    id: CUSTOM_THEME_ID,
    label: "Custom",
    background: { kind: "linear", from, to, angle: 165 },
    text: pickTextColor([from, to]),
    glow: "rgba(255,255,255,0.18)",
  };
}

export interface CaptionStyle {
  fontId: string;
  weight: 600 | 700 | 800;
  align: "center" | "left";
  /** 0.8–1.3 multiplier on the auto size. */
  scale: number;
  /** Override the theme's text color. */
  color: string | null;
}

export interface StudioStyle {
  layout: LayoutId;
  themeId: string;
  /** Used when themeId is "custom". */
  custom: { from: string; to: string };
  frames: boolean;
  /** 0.8–1.15 multiplier on device size. */
  deviceScale: number;
  caption: CaptionStyle;
}

export const DEFAULT_STYLE: StudioStyle = {
  layout: "hero",
  themeId: AUTO_THEME_ID,
  custom: { from: "#6366f1", to: "#0f172a" },
  frames: true,
  deviceScale: 1,
  caption: { fontId: "outfit", weight: 700, align: "center", scale: 1, color: null },
};

export interface ShotCopy {
  headline: string;
  subtitle: string;
}

export function resolveTheme(style: StudioStyle, autoTheme: Theme | null): Theme {
  if (style.themeId === CUSTOM_THEME_ID) return customTheme(style.custom.from, style.custom.to);
  if (style.themeId === AUTO_THEME_ID) return autoTheme ?? THEMES[0]!;
  return THEMES.find((t) => t.id === style.themeId) ?? THEMES[0]!;
}

/** Defensive merge for persisted/cloud styles (old or partial objects). */
export function normalizeStyle(raw: unknown): StudioStyle {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<StudioStyle>;
  const layout = LAYOUTS.some((l) => l.id === r.layout) ? (r.layout as LayoutId) : DEFAULT_STYLE.layout;
  const clamp = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
  const cap = (r.caption ?? {}) as Partial<CaptionStyle>;
  return {
    layout,
    themeId: typeof r.themeId === "string" ? r.themeId : DEFAULT_STYLE.themeId,
    custom: {
      from: typeof r.custom?.from === "string" ? r.custom.from : DEFAULT_STYLE.custom.from,
      to: typeof r.custom?.to === "string" ? r.custom.to : DEFAULT_STYLE.custom.to,
    },
    frames: typeof r.frames === "boolean" ? r.frames : DEFAULT_STYLE.frames,
    deviceScale: clamp(r.deviceScale, 0.8, 1.15, 1),
    caption: {
      fontId: typeof cap.fontId === "string" ? cap.fontId : DEFAULT_STYLE.caption.fontId,
      weight: cap.weight === 600 || cap.weight === 800 ? cap.weight : 700,
      align: cap.align === "left" ? "left" : "center",
      scale: clamp(cap.scale, 0.8, 1.3, 1),
      color: typeof cap.color === "string" ? cap.color : null,
    },
  };
}
