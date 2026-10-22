import type { Background } from "./background";
import { DEFAULT_BACKGROUND } from "./background";
import type { FitMode } from "./resize";
import type { FontWeight } from "./fonts";
import type { GraphicLayer } from "./graphics";

export type TextAlign = "left" | "center" | "right";
export type TextPosition = "top" | "bottom";
export type DeviceLayout =
  | "single"
  | "dual-side"
  | "dual-overlap"
  | "dual-angled"
  | "foldable-closed"
  | "foldable-open";

export function isDualLayout(layout: DeviceLayout): boolean {
  return (
    layout === "dual-side" ||
    layout === "dual-overlap" ||
    layout === "dual-angled"
  );
}

export function isFoldableLayout(layout: DeviceLayout): boolean {
  return layout === "foldable-closed" || layout === "foldable-open";
}

export interface TextStyle {
  headline: string;
  subtitle: string;
  fontId: string;
  headlineSize: number;
  subtitleSize: number;
  weight: FontWeight;
  color: string;
  align: TextAlign;
  position: TextPosition;
  /** Vertical inset from edge as % of canvas height (0–40). */
  insetPercent: number;
}

export interface DesignState {
  background: Background;
  frames: boolean;
  mode: FitMode;
  text: TextStyle;
  layout: DeviceLayout;
  /** Show center guides / snap lines in the live preview. */
  showGuides: boolean;
  /** Snap text inset to 5% steps when adjusting. */
  snapEnabled: boolean;
  /** Decorative AI / custom graphic layers (drawn above background). */
  graphics: GraphicLayer[];
}

export interface LayoutTemplate {
  id: string;
  label: string;
  description: string;
  design: Partial<DesignState>;
}

export const DEFAULT_TEXT: TextStyle = {
  headline: "",
  subtitle: "",
  fontId: "outfit",
  headlineSize: 64,
  subtitleSize: 32,
  weight: 700,
  color: "#ffffff",
  align: "center",
  position: "top",
  insetPercent: 8,
};

export const DEFAULT_DESIGN: DesignState = {
  background: DEFAULT_BACKGROUND,
  frames: true,
  mode: "contain",
  text: DEFAULT_TEXT,
  layout: "single",
  showGuides: true,
  snapEnabled: true,
  graphics: [],
};

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: "clean-frame",
    label: "Clean frame",
    description: "Single device, no caption, dark canvas",
    design: {
      layout: "single",
      frames: true,
      mode: "contain",
      background: { kind: "solid", color: "#0a0f14" },
      text: { ...DEFAULT_TEXT, headline: "", subtitle: "" },
    },
  },
  {
    id: "headline-top",
    label: "Headline top",
    description: "Bold caption above a framed phone",
    design: {
      layout: "single",
      frames: true,
      mode: "contain",
      background: {
        kind: "gradient",
        from: "#0b3d3a",
        to: "#0a0f14",
        direction: "vertical",
      },
      text: {
        ...DEFAULT_TEXT,
        headline: "Built for focus",
        subtitle: "Your day, clarified",
        position: "top",
        color: "#f4f7f6",
        headlineSize: 72,
      },
    },
  },
  {
    id: "caption-bottom",
    label: "Caption bottom",
    description: "Soft mist background with bottom copy",
    design: {
      layout: "single",
      frames: true,
      mode: "contain",
      background: {
        kind: "gradient",
        from: "#dce8e6",
        to: "#f3f6f5",
        direction: "vertical",
      },
      text: {
        ...DEFAULT_TEXT,
        headline: "See more. Do less.",
        subtitle: "Available on iPhone",
        position: "bottom",
        color: "#12202a",
        headlineSize: 60,
      },
    },
  },
  {
    id: "dual-side",
    label: "Dual side-by-side",
    description: "Two iPhones sharing one canvas",
    design: {
      layout: "dual-side",
      frames: true,
      mode: "contain",
      background: { kind: "solid", color: "#101820" },
      text: {
        ...DEFAULT_TEXT,
        headline: "Two views. One flow.",
        subtitle: "",
        position: "top",
        headlineSize: 56,
      },
    },
  },
  {
    id: "dual-overlap",
    label: "Dual overlap",
    description: "Stacked phones with depth",
    design: {
      layout: "dual-overlap",
      frames: true,
      mode: "contain",
      background: {
        kind: "gradient",
        from: "#1a3a36",
        to: "#0c1218",
        direction: "diagonal-down",
      },
      text: {
        ...DEFAULT_TEXT,
        headline: "Depth in every tap",
        subtitle: "",
        position: "bottom",
        headlineSize: 58,
      },
    },
  },
  {
    id: "dual-angled",
    label: "Dual angled",
    description: "Slightly rotated pair for energy",
    design: {
      layout: "dual-angled",
      frames: true,
      mode: "contain",
      background: {
        kind: "gradient",
        from: "#0e4a44",
        to: "#0a1620",
        direction: "horizontal",
      },
      text: {
        ...DEFAULT_TEXT,
        headline: "Ready when you are",
        subtitle: "iPhone · App Store",
        position: "top",
        headlineSize: 54,
      },
    },
  },
  {
    id: "foldable-open",
    label: "Foldable open",
    description: "MIT iPhone Duo open bezel (bunlongheng/frames)",
    design: {
      layout: "foldable-open",
      frames: true,
      mode: "contain",
      background: {
        kind: "gradient",
        from: "#102a28",
        to: "#0a0f14",
        direction: "vertical",
      },
      text: {
        ...DEFAULT_TEXT,
        headline: "Unfold the next view",
        subtitle: "iPhone Duo · open",
        position: "top",
        headlineSize: 56,
      },
    },
  },
  {
    id: "foldable-closed",
    label: "Foldable closed",
    description: "MIT iPhone Duo cover/closed bezel",
    design: {
      layout: "foldable-closed",
      frames: true,
      mode: "contain",
      background: { kind: "solid", color: "#0c1218" },
      text: {
        ...DEFAULT_TEXT,
        headline: "Pocket-ready",
        subtitle: "iPhone Duo · closed",
        position: "bottom",
        headlineSize: 58,
      },
    },
  },
  {
    id: "header-hero",
    label: "Header hero",
    description: "Wide product-page header composition",
    design: {
      layout: "single",
      frames: true,
      mode: "contain",
      background: {
        kind: "gradient",
        from: "#0f766e",
        to: "#0a1620",
        direction: "horizontal",
      },
      text: {
        ...DEFAULT_TEXT,
        headline: "Your brand, front and center",
        subtitle: "Product page header",
        position: "top",
        align: "left",
        headlineSize: 96,
        insetPercent: 12,
      },
    },
  },
  {
    id: "search-impact",
    label: "Search impact",
    description: "3:2 search-results creative",
    design: {
      layout: "dual-side",
      frames: true,
      mode: "contain",
      background: { kind: "solid", color: "#0a0f14" },
      text: {
        ...DEFAULT_TEXT,
        headline: "Find it. Love it.",
        subtitle: "Search results creative",
        position: "top",
        headlineSize: 80,
      },
    },
  },
];

export function snapInset(value: number, enabled: boolean): number {
  const clamped = Math.max(0, Math.min(40, value));
  if (!enabled) return clamped;
  return Math.round(clamped / 5) * 5;
}

export function mergeTemplate(
  current: DesignState,
  template: LayoutTemplate,
): DesignState {
  return {
    ...current,
    ...template.design,
    text: { ...current.text, ...template.design.text },
    background: template.design.background ?? current.background,
    graphics: template.design.graphics ?? current.graphics,
  };
}
