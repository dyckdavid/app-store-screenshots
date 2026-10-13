import { describe, expect, it } from "vitest";
import {
  coverFillsWithoutLetterbox,
  fittedImageRect,
  framedDevicePlacement,
} from "./geometry";

describe("fittedImageRect cover-fill (screen hole)", () => {
  const screen = { x: 100, y: 100, width: 1320, height: 2868 };

  it("cover-fills a wider screenshot without letterboxing inside the screen", () => {
    // Landscape-ish source into tall screen — must cover both axes
    const dest = fittedImageRect(2000, 1000, screen, "cover");
    expect(dest.width).toBeGreaterThanOrEqual(screen.width - 0.01);
    expect(dest.height).toBeGreaterThanOrEqual(screen.height - 0.01);
    expect(coverFillsWithoutLetterbox(2000, 1000, screen)).toBe(true);
  });

  it("cover-fills a taller screenshot without letterboxing", () => {
    const dest = fittedImageRect(800, 2000, screen, "cover");
    expect(dest.width).toBeGreaterThanOrEqual(screen.width - 0.01);
    expect(dest.height).toBeGreaterThanOrEqual(screen.height - 0.01);
  });

  it("contain may letterbox (smaller than screen on one axis)", () => {
    const dest = fittedImageRect(2000, 1000, screen, "contain");
    const fillsWidth = dest.width >= screen.width - 0.01;
    const fillsHeight = dest.height >= screen.height - 0.01;
    expect(fillsWidth && fillsHeight).toBe(false);
  });
});

describe("framedDevicePlacement (ASC scale after cover-fill)", () => {
  const frame = { width: 1520, height: 3068 };
  const asc = { width: 1320, height: 2868 };

  it("contain fits the whole framed device inside the ASC canvas", () => {
    const place = framedDevicePlacement(
      frame.width,
      frame.height,
      asc.width,
      asc.height,
      "contain",
    );
    expect(place.width).toBeLessThanOrEqual(asc.width + 0.01);
    expect(place.height).toBeLessThanOrEqual(asc.height + 0.01);
    // At least one axis should touch the canvas edge (fit).
    const touchesW = Math.abs(place.width - asc.width) < 0.5;
    const touchesH = Math.abs(place.height - asc.height) < 0.5;
    expect(touchesW || touchesH).toBe(true);
  });

  it("cover fills the ASC canvas (may crop bezel)", () => {
    const place = framedDevicePlacement(
      frame.width,
      frame.height,
      asc.width,
      asc.height,
      "cover",
    );
    expect(place.width).toBeGreaterThanOrEqual(asc.width - 0.01);
    expect(place.height).toBeGreaterThanOrEqual(asc.height - 0.01);
  });
});
