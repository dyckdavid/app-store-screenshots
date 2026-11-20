/** Export targets, file naming, and browser persistence for the studio. */
import { SCREENSHOT_SIZES, type PlatformId, type ScreenshotSize } from "@/lib/sizes";
import { normalizeStyle, type ShotCopy, type StudioStyle } from "./model";

/** Apple currently requires only 6.9" (or 6.5") iPhone + 13" iPad. */
export const DEFAULT_SIZE_IDS = ["iphone-69-portrait", "iphone-65-portrait"];

export const SIZE_GROUPS: { platform: PlatformId; label: string; hint: string }[] = [
  { platform: "iphone", label: "iPhone", hint: '6.9" is required; 6.5" covers older listings' },
  { platform: "ipad", label: "iPad", hint: '13" is required if your app runs on iPad' },
  { platform: "mac", label: "Mac", hint: "16:10 Mac App Store sizes" },
  { platform: "watch", label: "Apple Watch", hint: "Full-bleed screen, no caption" },
  { platform: "dual", label: "Dual iPhone", hint: "Always two devices (this + next shot)" },
  { platform: "header", label: "Product page header", hint: "Wide creative" },
  { platform: "search", label: "Search results", hint: "3:2 / 16:9 creative" },
];

export function sizesById(ids: string[]): ScreenshotSize[] {
  const set = new Set(ids);
  return SCREENSHOT_SIZES.filter((s) => set.has(s.id));
}

export function sizeLabel(size: ScreenshotSize): string {
  const o = size.platform === "mac" || size.platform === "header" || size.platform === "search" || size.platform === "watch"
    ? ""
    : ` ${size.orientation}`;
  return `${size.displayName}${o} · ${size.width}×${size.height}`;
}

/** ZIP path: one folder per ASC display size, files numbered in upload order. */
export function exportPath(size: ScreenshotSize, index: number, sourceName: string): string {
  const folder = `${size.displayName.replace(/["/\\]/g, "in").replace(/\s+/g, " ").trim()} ${size.width}x${size.height}`;
  const stem = sourceName.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_").slice(0, 40) || "shot";
  return `${folder}/${String(index + 1).padStart(2, "0")}_${stem}.png`;
}

// ---- persistence (per-browser; never required for the editor to work) ----

const DRAFT_KEY = "asc-studio-draft-v2";
const PRESETS_KEY = "asc-studio-style-presets-v2";

export interface Draft {
  style: StudioStyle;
  sizeIds: string[];
  /** Captions keyed by screenshot file name, restored on re-upload. */
  copies: Record<string, ShotCopy>;
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadDraft(): Draft | null {
  try {
    const raw = storage()?.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    const valid = new Set(SCREENSHOT_SIZES.map((s) => s.id));
    const sizeIds = Array.isArray(d.sizeIds) ? d.sizeIds.filter((id) => valid.has(id)) : [];
    return {
      style: normalizeStyle(d.style),
      sizeIds: sizeIds.length ? sizeIds : DEFAULT_SIZE_IDS,
      copies: d.copies && typeof d.copies === "object" ? d.copies : {},
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft): void {
  try {
    storage()?.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // quota / private mode: ignore
  }
}

export interface StylePreset {
  id: string;
  name: string;
  savedAt: number;
  style: StudioStyle;
}

export function loadStylePresets(): StylePreset[] {
  try {
    const raw = storage()?.getItem(PRESETS_KEY);
    const list = raw ? (JSON.parse(raw) as StylePreset[]) : [];
    return Array.isArray(list)
      ? list
          .filter((p) => p && typeof p.id === "string" && typeof p.name === "string")
          .map((p) => ({ ...p, style: normalizeStyle(p.style) }))
      : [];
  } catch {
    return [];
  }
}

export function saveStylePresets(list: StylePreset[]): void {
  try {
    storage()?.setItem(PRESETS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}
