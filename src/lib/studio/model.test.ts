import { describe, expect, it } from "vitest";
import { contrastRatio, dominantColor, hexToRgb, hslToHex, pickTextColor, rgbToHex, rgbToHsl } from "./color";
import {
  AUTO_THEME_ID,
  CUSTOM_THEME_ID,
  DEFAULT_STYLE,
  THEMES,
  normalizeStyle,
  resolveTheme,
  themeFromColor,
} from "./model";
import { exportPath } from "./project";
import { SCREENSHOT_SIZES } from "@/lib/sizes";

function bgColors(t: (typeof THEMES)[number]): string[] {
  const b = t.background;
  if (b.kind === "solid") return [b.color];
  if (b.kind === "linear") return [b.from, b.to];
  if (b.kind === "mesh") return [b.base, ...b.blobs.map((x) => x.color)];
  return ["#000000"];
}

describe("color", () => {
  it("round-trips hex ↔ rgb ↔ hsl", () => {
    expect(rgbToHex(hexToRgb("#3b82f6"))).toBe("#3b82f6");
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    const hsl = rgbToHsl(hexToRgb("#3b82f6"));
    expect(hslToHex(hsl.h, hsl.s, hsl.l)).toBe("#3b82f6");
  });

  it("contrast ratio matches WCAG endpoints", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("picks dark text on light and white on dark", () => {
    expect(pickTextColor(["#ffffff", "#f2f2f7"])).not.toBe("#ffffff");
    expect(pickTextColor(["#0b1023", "#1e3a8a"])).toBe("#ffffff");
  });

  it("finds the brand color while ignoring white UI chrome", () => {
    const px: number[] = [];
    for (let i = 0; i < 900; i++) px.push(250, 250, 250, 255); // white UI
    for (let i = 0; i < 100; i++) px.push(239, 68, 68, 255); // red accent
    const c = hexToRgb(dominantColor(px, 1));
    expect(c.r).toBeGreaterThan(200);
    expect(c.g).toBeLessThan(100);
  });

  it("falls back to the average for grayscale screenshots", () => {
    const px = [10, 10, 10, 255, 30, 30, 30, 255];
    expect(dominantColor(px, 1)).toBe("#141414");
  });
});

describe("themes", () => {
  it.each(THEMES.map((t) => [t.id, t] as const))("%s caption text is readable (≥ 3:1 on every stop)", (_id, t) => {
    for (const c of bgColors(t)) expect(contrastRatio(t.text, c)).toBeGreaterThanOrEqual(3);
  });

  it("auto theme from any brand color has readable text", () => {
    for (const hex of ["#ef4444", "#f59e0b", "#84cc16", "#06b6d4", "#6366f1", "#ec4899", "#ffffff", "#000000"]) {
      const t = themeFromColor(hex);
      if (t.background.kind !== "mesh") throw new Error("expected mesh");
      const top = t.background.blobs[0]!.color;
      const base = t.background.base;
      expect(Math.min(contrastRatio(t.text, top), contrastRatio(t.text, base))).toBeGreaterThanOrEqual(2.5);
    }
  });

  it("resolves auto, custom, and named themes", () => {
    const auto = themeFromColor("#ff0000");
    expect(resolveTheme({ ...DEFAULT_STYLE, themeId: AUTO_THEME_ID }, auto)).toBe(auto);
    expect(resolveTheme({ ...DEFAULT_STYLE, themeId: AUTO_THEME_ID }, null).id).toBe(THEMES[0]!.id);
    expect(resolveTheme({ ...DEFAULT_STYLE, themeId: CUSTOM_THEME_ID }, null).id).toBe(CUSTOM_THEME_ID);
    expect(resolveTheme({ ...DEFAULT_STYLE, themeId: "ocean" }, null).id).toBe("ocean");
  });
});

describe("normalizeStyle", () => {
  it("fills defaults for junk / legacy objects", () => {
    expect(normalizeStyle(null)).toEqual(DEFAULT_STYLE);
    expect(normalizeStyle({ layout: "dual-side", headlineSize: 64 })).toEqual(DEFAULT_STYLE);
  });
  it("clamps numeric ranges", () => {
    const s = normalizeStyle({ deviceScale: 5, caption: { scale: 0.1 } });
    expect(s.deviceScale).toBe(1.15);
    expect(s.caption.scale).toBe(0.8);
  });
});

describe("exportPath", () => {
  it("foldered by display size, numbered in order, safe names", () => {
    const size = SCREENSHOT_SIZES.find((s) => s.id === "iphone-69-portrait")!;
    expect(exportPath(size, 0, "My Shot (1).png")).toBe("iPhone 6.9in Display 1320x2868/01_My_Shot_1_.png");
    expect(exportPath(size, 11, "x.jpg")).toMatch(/\/12_x\.png$/);
  });
});
