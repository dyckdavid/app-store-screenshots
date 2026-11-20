import { describe, expect, it } from "vitest";
import { FONT_OPTIONS, canvasFontFamily } from "./fonts";

describe("canvasFontFamily", () => {
  it.each(FONT_OPTIONS.map((f) => [f.id, f.label] as const))("%s never yields an unquoted family with digits", (id) => {
    const family = canvasFontFamily(id);
    // Each comma-separated family is either quoted, a CSS generic, or a plain identifier.
    for (const part of family.split(",").map((p) => p.trim())) {
      const quoted = /^(["']).*\1$/.test(part);
      expect(quoted || /^[A-Za-z-]+( [A-Za-z-]+)*$/.test(part)).toBe(true);
    }
  });
});
