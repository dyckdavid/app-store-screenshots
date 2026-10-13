/**
 * Font catalog for canvas text overlays.
 * Google fonts are self-hosted via next/font (see app/layout.tsx CSS variables).
 * Web-safe fonts use the system stack and need no download.
 */

export type FontWeight = 400 | 500 | 600 | 700 | 800;

export interface FontOption {
  id: string;
  label: string;
  /** CSS font-family used on canvas and in the UI */
  family: string;
  kind: "google" | "websafe";
  /** CSS variable set by next/font when kind === "google" */
  cssVar?: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "outfit",
    label: "Outfit",
    family: "var(--font-outfit), Outfit, sans-serif",
    kind: "google",
    cssVar: "--font-outfit",
  },
  {
    id: "fraunces",
    label: "Fraunces",
    family: "var(--font-fraunces), Fraunces, serif",
    kind: "google",
    cssVar: "--font-fraunces",
  },
  {
    id: "source-sans",
    label: "Source Sans 3",
    family: "var(--font-source-sans), 'Source Sans 3', sans-serif",
    kind: "google",
    cssVar: "--font-source-sans",
  },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    family: "var(--font-jetbrains), 'JetBrains Mono', monospace",
    kind: "google",
    cssVar: "--font-jetbrains",
  },
  {
    id: "arial",
    label: "Arial",
    family: "Arial, Helvetica, sans-serif",
    kind: "websafe",
  },
  {
    id: "georgia",
    label: "Georgia",
    family: "Georgia, 'Times New Roman', serif",
    kind: "websafe",
  },
  {
    id: "verdana",
    label: "Verdana",
    family: "Verdana, Geneva, sans-serif",
    kind: "websafe",
  },
  {
    id: "trebuchet",
    label: "Trebuchet MS",
    family: "'Trebuchet MS', Tahoma, sans-serif",
    kind: "websafe",
  },
  {
    id: "courier",
    label: "Courier New",
    family: "'Courier New', Courier, monospace",
    kind: "websafe",
  },
  {
    id: "times",
    label: "Times New Roman",
    family: "'Times New Roman', Times, serif",
    kind: "websafe",
  },
];

export function fontById(id: string): FontOption {
  return FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[0]!;
}

/** Resolve a canvas-ready family string (strip CSS vars for canvas). */
export function canvasFontFamily(id: string): string {
  const opt = fontById(id);
  if (opt.kind === "websafe") return opt.family;
  // next/font injects the actual family name on :root via the variable value.
  if (typeof document !== "undefined" && opt.cssVar) {
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue(opt.cssVar)
      .trim();
    if (resolved) return `${resolved}, ${opt.label}, sans-serif`;
  }
  return `"${opt.label}", sans-serif`;
}

export async function ensureFontsReady(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.ready) return;
  await document.fonts.ready;
}
