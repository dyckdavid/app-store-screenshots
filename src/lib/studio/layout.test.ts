import { describe, expect, it } from "vitest";
import { SCREENSHOT_SIZES } from "@/lib/sizes";
import {
  boxesIntersect,
  deviceFamilyForShot,
  chooseArrangement,
  computeLayout,
  fitCaption,
  placeInSlot,
  wrapBalanced,
  wrapText,
  type Box,
  type Measure,
} from "./layout";
import { LAYOUTS, type LayoutId } from "./model";

/** Deterministic text measure: 0.55em per character. */
const measure: Measure = (t, s) => t.length * s * 0.55;

// Framed device aspect ratios (from the vendored bezel templates).
const IPHONE_PORTRAIT = 1520 / 3068;
const IPHONE_LANDSCAPE = 3068 / 1520;
const MAC = 3306 / 1897;

function deviceAspectFor(platform: string, w: number, h: number) {
  if (platform === "mac") return MAC;
  // Assume screenshots are uploaded in the canvas orientation, except
  // creatives which use a portrait phone.
  if (platform === "header" || platform === "search") return IPHONE_PORTRAIT;
  return w > h ? IPHONE_LANDSCAPE : IPHONE_PORTRAIT;
}

/** The visible (on-canvas) part of a box. */
function clip(b: Box, W: number, H: number): Box {
  const x = Math.max(0, b.x);
  const y = Math.max(0, b.y);
  return { x, y, width: Math.min(W, b.x + b.width) - x, height: Math.min(H, b.y + b.height) - y };
}

const sizes = SCREENSHOT_SIZES.filter((s) => s.platform !== "watch");
const layouts = LAYOUTS.map((l) => l.id);

describe("computeLayout across every ASC size × layout", () => {
  for (const size of sizes) {
    for (const layout of layouts) {
      for (const hasSecondary of [false, true]) {
        it(`${size.id} · ${layout}${hasSecondary ? " · 2 shots" : ""}`, () => {
          const aspect = deviceAspectFor(size.platform, size.width, size.height);
          const scene = computeLayout({
            width: size.width,
            height: size.height,
            layout: layout as LayoutId,
            deviceAspect: aspect,
            hasCaption: true,
            hasSecondary,
          });

          // Caption fully on-canvas and reasonably large.
          const cap = scene.caption!;
          expect(cap).toBeTruthy();
          expect(cap.x).toBeGreaterThanOrEqual(0);
          expect(cap.y).toBeGreaterThanOrEqual(0);
          expect(cap.x + cap.width).toBeLessThanOrEqual(size.width + 0.5);
          expect(cap.y + cap.height).toBeLessThanOrEqual(size.height + 0.5);
          expect(cap.width).toBeGreaterThan(size.width * 0.3);

          // Headline base scales with the canvas (no fixed px sizes).
          expect(scene.headlineBase).toBeGreaterThan(Math.min(size.width, size.height) * 0.04);

          for (const slot of scene.devices) {
            const rect = placeInSlot(aspect * 1000, 1000, slot);
            // Aspect is preserved.
            expect(rect.width / rect.height).toBeCloseTo(aspect, 5);
            // The device never covers the caption (text is never drawn over a screen).
            if (slot.rotation === 0) {
              expect(boxesIntersect(rect, cap)).toBe(false);
            }
            // The device is substantially visible.
            const vis = clip(rect, size.width, size.height);
            expect(vis.width * vis.height).toBeGreaterThan(rect.width * rect.height * 0.55);
            // Horizontally on-canvas (bleed is only allowed vertically).
            expect(rect.x).toBeGreaterThanOrEqual(-0.5);
            expect(rect.x + rect.width).toBeLessThanOrEqual(size.width + 0.5);
          }

          // Duo uses two devices only when a second shot exists.
          if (layout === "duo") expect(scene.devices).toHaveLength(hasSecondary ? 2 : 1);
          else expect(scene.devices).toHaveLength(1);
        });
      }
    }
  }
});

describe("hero layout", () => {
  it("makes the phone big on a 6.9\" portrait canvas (≥ 75% width or ≥ 70% height)", () => {
    const scene = computeLayout({ width: 1320, height: 2868, layout: "hero", deviceAspect: IPHONE_PORTRAIT, hasCaption: true, hasSecondary: false });
    const r = placeInSlot(IPHONE_PORTRAIT * 1000, 1000, scene.devices[0]!);
    expect(r.width / 1320 > 0.75 || r.height / 2868 > 0.7).toBe(true);
    // ...and bleeds off the bottom edge.
    expect(r.y + r.height).toBeGreaterThan(2868);
  });

  it("without a caption the device uses the freed space", () => {
    const withCap = computeLayout({ width: 1320, height: 2868, layout: "classic", deviceAspect: IPHONE_PORTRAIT, hasCaption: true, hasSecondary: false });
    const noCap = computeLayout({ width: 1320, height: 2868, layout: "classic", deviceAspect: IPHONE_PORTRAIT, hasCaption: false, hasSecondary: false });
    const a = placeInSlot(500, 1000, withCap.devices[0]!);
    const b = placeInSlot(500, 1000, noCap.devices[0]!);
    expect(noCap.caption).toBeNull();
    expect(b.height).toBeGreaterThan(a.height);
  });
});

describe("arrangement", () => {
  it("puts an upright phone beside the caption on wide canvases", () => {
    expect(chooseArrangement(3840, 1646, IPHONE_PORTRAIT)).toBe("side");
    expect(chooseArrangement(2868, 1320, IPHONE_PORTRAIT)).toBe("side");
  });
  it("stacks caption above landscape devices and on portrait canvases", () => {
    expect(chooseArrangement(2880, 1800, MAC)).toBe("stacked");
    expect(chooseArrangement(2868, 1320, IPHONE_LANDSCAPE)).toBe("stacked");
    expect(chooseArrangement(1320, 2868, IPHONE_PORTRAIT)).toBe("stacked");
  });
  it("caption-bottom puts the caption below on portrait canvases", () => {
    const s = computeLayout({ width: 1320, height: 2868, layout: "caption-bottom", deviceAspect: IPHONE_PORTRAIT, hasCaption: true, hasSecondary: false });
    expect(s.caption!.y).toBeGreaterThan(2868 / 2);
  });
});

describe("text fitting", () => {
  it("wraps on spaces and honors explicit line breaks", () => {
    expect(wrapText("one two three", 10_000, 10, measure)).toEqual(["one two three"]);
    expect(wrapText("one\ntwo", 10_000, 10, measure)).toEqual(["one", "two"]);
  });

  it("balanced wrap avoids a lonely last word", () => {
    const text = "Plan your whole week in seconds";
    const greedy = wrapText(text, 22 * 10 * 0.55, 10, measure);
    const balanced = wrapBalanced(text, 22 * 10 * 0.55, 10, measure);
    expect(balanced.length).toBe(greedy.length);
    const spread = (ls: string[]) => Math.max(...ls.map((l) => l.length)) - Math.min(...ls.map((l) => l.length));
    expect(spread(balanced)).toBeLessThanOrEqual(spread(greedy));
  });

  it("shrinks long headlines until they fit 3 lines and the box", () => {
    const box = { x: 0, y: 0, width: 1000, height: 500 };
    const long = "This is a very long headline that keeps going and going far beyond what fits on three lines at the base size";
    const fit = fitCaption(long, "And a subtitle", box, 120, measure, measure);
    expect(fit.headlineLines.length).toBeLessThanOrEqual(3);
    expect(fit.blockHeight).toBeLessThanOrEqual(box.height);
    expect(fit.headlineSize).toBeLessThan(120);
    for (const l of fit.headlineLines) expect(measure(l, fit.headlineSize)).toBeLessThanOrEqual(box.width + 0.5);
  });

  it("keeps short headlines at full size", () => {
    const fit = fitCaption("Short", "", { x: 0, y: 0, width: 1000, height: 500 }, 100, measure, measure);
    expect(fit.headlineSize).toBe(100);
    expect(fit.subtitleLines).toEqual([]);
  });

  it("applies the caption scale", () => {
    const box = { x: 0, y: 0, width: 2000, height: 1000 };
    const a = fitCaption("Hi", "", box, 100, measure, measure, { scale: 1.2 });
    expect(a.headlineSize).toBeCloseTo(120);
  });
});

describe("deviceFamilyForShot", () => {
  it.each([
    [1320, 2868, "iphone"],
    [2868, 1320, "iphone"],
    [1170, 2532, "iphone"],
    [2064, 2752, "ipad"],
    [2752, 2064, "ipad"],
    [1668, 2420, "ipad"],
    [2880, 1800, "mac"],
    [1280, 800, "mac"],
    [1800, 2880, "card"],
  ] as const)("%ix%i → %s", (w, h, family) => {
    expect(deviceFamilyForShot(w, h)).toBe(family);
  });
});
