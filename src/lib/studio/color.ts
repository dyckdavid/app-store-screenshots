/** Pure color utilities (no DOM) for themes, contrast, and auto-palettes. */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = Number.parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n) || h.length < 6) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG relative luminance (0–1). */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const INK = "#0b0d12";
export const WHITE = "#ffffff";

/** Best readable text color over a set of background colors (worst case). */
export function pickTextColor(backgrounds: string[]): string {
  const worst = (fg: string) => Math.min(...backgrounds.map((bg) => contrastRatio(fg, bg)));
  return worst(WHITE) >= worst(INK) ? WHITE : INK;
}

export function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return { h: h * 60, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(1, s));
  const ll = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  const [r, g, b] =
    hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

/**
 * Dominant "brand" color from RGBA pixels: hue histogram weighted by
 * saturation, ignoring near-white/near-black UI chrome. Falls back to the
 * average color for grayscale screenshots.
 */
export function dominantColor(data: ArrayLike<number>, step = 4): string {
  const bins = new Array<number>(36).fill(0);
  const sums = Array.from({ length: 36 }, () => ({ r: 0, g: 0, b: 0, n: 0 }));
  let ar = 0;
  let ag = 0;
  let ab = 0;
  let an = 0;
  for (let i = 0; i + 3 < data.length; i += 4 * step) {
    const rgb = { r: data[i]!, g: data[i + 1]!, b: data[i + 2]! };
    ar += rgb.r;
    ag += rgb.g;
    ab += rgb.b;
    an++;
    const { h, s, l } = rgbToHsl(rgb);
    if (s < 0.25 || l < 0.12 || l > 0.92) continue;
    const bin = Math.min(35, Math.floor(h / 10));
    const w = s * (1 - Math.abs(l - 0.5));
    bins[bin]! += w;
    const acc = sums[bin]!;
    acc.r += rgb.r;
    acc.g += rgb.g;
    acc.b += rgb.b;
    acc.n++;
  }
  let best = -1;
  let bestW = 0;
  bins.forEach((w, i) => {
    if (w > bestW) {
      bestW = w;
      best = i;
    }
  });
  if (best >= 0 && sums[best]!.n > 0 && bestW > an * 0.01) {
    const s = sums[best]!;
    return rgbToHex({ r: s.r / s.n, g: s.g / s.n, b: s.b / s.n });
  }
  if (an === 0) return "#3b82f6";
  return rgbToHex({ r: ar / an, g: ag / an, b: ab / an });
}
