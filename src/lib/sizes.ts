/**
 * App Store Connect screenshot + creative asset specifications.
 *
 * Screenshots:
 * https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
 *
 * Creative assets (product page header + search results):
 * https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications/
 *
 * Best practices / context:
 * https://developer.apple.com/app-store/asset-best-practices/
 */

export type PlatformId =
  | "iphone"
  | "ipad"
  | "mac"
  | "watch"
  | "header"
  | "search"
  | "dual";

export type Orientation = "portrait" | "landscape";

export interface PlatformMeta {
  id: PlatformId;
  label: string;
  group: "device" | "creative" | "layout";
}

export interface ScreenshotSize {
  id: string;
  platform: PlatformId;
  /** Display name Apple uses (or our label for creative/dual). */
  displayName: string;
  width: number;
  height: number;
  orientation: Orientation;
  /** Optional note shown in UI / README */
  note?: string;
}

export const PLATFORMS: PlatformMeta[] = [
  { id: "iphone", label: "iPhone", group: "device" },
  { id: "ipad", label: "iPad", group: "device" },
  { id: "mac", label: "Mac", group: "device" },
  { id: "watch", label: "Apple Watch", group: "device" },
  { id: "header", label: "Header", group: "creative" },
  { id: "search", label: "Search", group: "creative" },
  { id: "dual", label: "Dual iPhone", group: "layout" },
];

export const DEFAULT_PLATFORMS: PlatformId[] = [
  "iphone",
  "ipad",
  "header",
  "search",
  "dual",
];

/** Primary ASC sizes used by this tool (one accepted size per display class). */
export const SCREENSHOT_SIZES: ScreenshotSize[] = [
  // ——— iPhone ———
  {
    id: "iphone-69-portrait",
    platform: "iphone",
    displayName: 'iPhone 6.9" Display',
    width: 1320,
    height: 2868,
    orientation: "portrait",
    note: "Accepted size for iPhone with Dynamic Island (large display)",
  },
  {
    id: "iphone-69-landscape",
    platform: "iphone",
    displayName: 'iPhone 6.9" Display',
    width: 2868,
    height: 1320,
    orientation: "landscape",
  },
  {
    id: "iphone-65-portrait",
    platform: "iphone",
    displayName: 'iPhone 6.5" Display',
    width: 1284,
    height: 2778,
    orientation: "portrait",
    note: "Required if large Dynamic Island screenshots are not provided",
  },
  {
    id: "iphone-65-landscape",
    platform: "iphone",
    displayName: 'iPhone 6.5" Display',
    width: 2778,
    height: 1284,
    orientation: "landscape",
  },
  {
    id: "iphone-63-portrait",
    platform: "iphone",
    displayName: 'iPhone 6.3" Display',
    width: 1206,
    height: 2622,
    orientation: "portrait",
  },
  {
    id: "iphone-63-landscape",
    platform: "iphone",
    displayName: 'iPhone 6.3" Display',
    width: 2622,
    height: 1206,
    orientation: "landscape",
  },
  {
    id: "iphone-61-portrait",
    platform: "iphone",
    displayName: 'iPhone 6.1" Display',
    width: 1170,
    height: 2532,
    orientation: "portrait",
  },
  {
    id: "iphone-61-landscape",
    platform: "iphone",
    displayName: 'iPhone 6.1" Display',
    width: 2532,
    height: 1170,
    orientation: "landscape",
  },
  // ——— iPad ———
  {
    id: "ipad-13-portrait",
    platform: "ipad",
    displayName: 'iPad 13" Display',
    width: 2064,
    height: 2752,
    orientation: "portrait",
    note: "Required if app runs on iPad",
  },
  {
    id: "ipad-13-landscape",
    platform: "ipad",
    displayName: 'iPad 13" Display',
    width: 2752,
    height: 2064,
    orientation: "landscape",
  },
  {
    id: "ipad-11-portrait",
    platform: "ipad",
    displayName: 'iPad 11" Display',
    width: 1668,
    height: 2420,
    orientation: "portrait",
  },
  {
    id: "ipad-11-landscape",
    platform: "ipad",
    displayName: 'iPad 11" Display',
    width: 2420,
    height: 1668,
    orientation: "landscape",
  },
  // ——— Mac ———
  {
    id: "mac-2880",
    platform: "mac",
    displayName: "Mac",
    width: 2880,
    height: 1800,
    orientation: "landscape",
    note: "Largest accepted 16:10 size",
  },
  {
    id: "mac-2560",
    platform: "mac",
    displayName: "Mac",
    width: 2560,
    height: 1600,
    orientation: "landscape",
  },
  {
    id: "mac-1440",
    platform: "mac",
    displayName: "Mac",
    width: 1440,
    height: 900,
    orientation: "landscape",
  },
  {
    id: "mac-1280",
    platform: "mac",
    displayName: "Mac",
    width: 1280,
    height: 800,
    orientation: "landscape",
    note: "Minimum accepted 16:10 size",
  },
  // ——— Apple Watch ———
  {
    id: "watch-ultra4",
    platform: "watch",
    displayName: "Apple Watch Ultra 4 / Ultra 3",
    width: 422,
    height: 514,
    orientation: "portrait",
  },
  {
    id: "watch-ultra2",
    platform: "watch",
    displayName: "Apple Watch Ultra 2 / Ultra",
    width: 410,
    height: 502,
    orientation: "portrait",
  },
  {
    id: "watch-series12",
    platform: "watch",
    displayName: "Apple Watch Series 12 / 11 / 10",
    width: 416,
    height: 496,
    orientation: "portrait",
  },
  {
    id: "watch-series9",
    platform: "watch",
    displayName: "Apple Watch Series 9 / 8 / 7",
    width: 396,
    height: 484,
    orientation: "portrait",
  },
  {
    id: "watch-series6",
    platform: "watch",
    displayName: "Apple Watch Series 6 / 5 / 4 / SE",
    width: 368,
    height: 448,
    orientation: "portrait",
  },
  {
    id: "watch-series3",
    platform: "watch",
    displayName: "Apple Watch Series 3 / 2 / 1",
    width: 312,
    height: 390,
    orientation: "portrait",
  },
  // ——— Product page header (creative assets) ———
  {
    id: "header-21-9",
    platform: "header",
    displayName: "Product page header (21:9)",
    width: 3840,
    height: 1646,
    orientation: "landscape",
    note: "Apple creative assets spec — exact 21:9 resolution",
  },
  {
    id: "header-universal-16-9",
    platform: "header",
    displayName: "Universal creative (16:9)",
    width: 5244,
    height: 2950,
    orientation: "landscape",
    note: "Apple lists 16:9 5244×2950 PNG for header/search universal asset",
  },
  // ——— Search results (creative assets) ———
  {
    id: "search-3-2",
    platform: "search",
    displayName: "Search results (3:2)",
    width: 3840,
    height: 2560,
    orientation: "landscape",
    note: "Apple allows 1920×1280–3840×2560 at 3:2; we export the maximum",
  },
  {
    id: "search-universal-16-9",
    platform: "search",
    displayName: "Universal creative (16:9)",
    width: 5244,
    height: 2950,
    orientation: "landscape",
    note: "Same universal 16:9 size listed for search results",
  },
  // ——— Dual iPhone layouts (exported at primary iPhone ASC size) ———
  {
    id: "dual-69-portrait",
    platform: "dual",
    displayName: 'Dual iPhone · 6.9" portrait',
    width: 1320,
    height: 2868,
    orientation: "portrait",
    note: "Two framed iPhones composed into one ASC iPhone canvas",
  },
  {
    id: "dual-69-landscape",
    platform: "dual",
    displayName: 'Dual iPhone · 6.9" landscape',
    width: 2868,
    height: 1320,
    orientation: "landscape",
    note: "Two framed iPhones on a landscape ASC canvas",
  },
];

export function formatSize(size: ScreenshotSize): string {
  return `${size.width}×${size.height}`;
}

export function sizesForPlatforms(
  platforms: PlatformId[],
): ScreenshotSize[] {
  const set = new Set(platforms);
  return SCREENSHOT_SIZES.filter((s) => set.has(s.platform));
}

export function fileStem(size: ScreenshotSize, sourceName: string): string {
  const base = sourceName
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w.-]+/g, "_");
  const orientation =
    size.platform === "mac" ||
    size.platform === "watch" ||
    size.platform === "header" ||
    size.platform === "search"
      ? ""
      : `_${size.orientation}`;
  return `${base}_${size.platform}_${size.width}x${size.height}${orientation}`;
}
