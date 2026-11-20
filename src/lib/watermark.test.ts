import { describe, expect, it } from "vitest";
import { estimateTextWidth, watermarkBadgeRect, WATERMARK_TEXT } from "./watermark";
import { shouldWatermark } from "./billing/plans";
import { SCREENSHOT_SIZES } from "./sizes";

describe("shouldWatermark", () => {
  it("watermarks free and anonymous, not paid plans", () => {
    expect(shouldWatermark("free")).toBe(true);
    expect(shouldWatermark(null)).toBe(true);
    expect(shouldWatermark(undefined)).toBe(true);
    expect(shouldWatermark("pro")).toBe(false);
    expect(shouldWatermark("lifetime")).toBe(false);
  });
});

describe("watermarkBadgeRect", () => {
  const cases: [number, number][] = [
    [1320, 2868], // iPhone 6.9" portrait
    [2868, 1320], // landscape
    [2064, 2752], // iPad 13"
    [2880, 1800], // Mac
    [410, 502], // Watch
    [3840, 1646], // product page header
  ];

  it.each(cases)("stays inside a %ix%i canvas, bottom-right", (w, h) => {
    const r = watermarkBadgeRect(w, h);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(w);
    expect(r.y + r.height).toBeLessThanOrEqual(h);
    // anchored to the bottom-right quadrant
    expect(r.x + r.width).toBeGreaterThan(w * 0.9);
    expect(r.y).toBeGreaterThan(h * 0.8);
  });

  it("is small and tasteful (<12% of canvas area)", () => {
    for (const [w, h] of cases) {
      const r = watermarkBadgeRect(w, h);
      expect((r.width * r.height) / (w * h)).toBeLessThan(0.12);
    }
  });

  it("never exceeds canvas width even with a huge label", () => {
    const r = watermarkBadgeRect(400, 400, () => 10_000);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(400);
  });

  it("uses a readable minimum font size", () => {
    expect(watermarkBadgeRect(200, 200).fontSize).toBeGreaterThanOrEqual(12);
    expect(estimateTextWidth(WATERMARK_TEXT, 20)).toBeGreaterThan(0);
  });

  it("fits every ASC size in the catalog", () => {
    for (const size of SCREENSHOT_SIZES) {
      const r = watermarkBadgeRect(size.width, size.height);
      expect(r.x + r.width).toBeLessThanOrEqual(size.width);
    }
  });
});
