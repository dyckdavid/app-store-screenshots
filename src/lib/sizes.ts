/**
 * App Store Connect screenshot specifications.
 * Source: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
 * Verified against Apple’s published sizes (portrait + landscape where required).
 *
 * For each display class we emit one accepted pixel size (the most common /
 * latest) so outputs stay practical. Mac and Watch use Apple’s accepted list.
 */

export type PlatformId = "iphone" | "ipad" | "mac" | "watch";

export type Orientation = "portrait" | "landscape";

export interface PlatformMeta {
  id: PlatformId;
  label: string;
}

export interface ScreenshotSize {
  id: string;
  platform: PlatformId;
  /** Display name Apple uses in App Store Connect */
  displayName: string;
  width: number;
  height: number;
  orientation: Orientation;
  /** Optional note shown in UI / README */
  note?: string;
}

export const PLATFORMS: PlatformMeta[] = [
  { id: "iphone", label: "iPhone" },
  { id: "ipad", label: "iPad" },
  { id: "mac", label: "Mac" },
  { id: "watch", label: "Apple Watch" },
];

export const DEFAULT_PLATFORMS: PlatformId[] = [
  "iphone",
  "ipad",
  "mac",
  "watch",
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
    note: "Primary required set for current iPhone apps",
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
    note: 'Required if 6.9" screenshots are not provided',
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
    size.platform === "mac" || size.platform === "watch"
      ? ""
      : `_${size.orientation}`;
  return `${base}_${size.platform}_${size.width}x${size.height}${orientation}`;
}
