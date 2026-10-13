import type { DesignState } from "./design";
import { DEFAULT_DESIGN } from "./design";

const STORAGE_KEY = "asc-studio-presets-v1";

export interface SavedPreset {
  id: string;
  name: string;
  savedAt: number;
  design: DesignState;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadPresets(): SavedPreset[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPreset[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p) => p && typeof p.id === "string" && typeof p.name === "string",
    );
  } catch {
    return [];
  }
}

export function savePresets(presets: SavedPreset[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function upsertPreset(name: string, design: DesignState): SavedPreset[] {
  const presets = loadPresets();
  const existing = presets.find(
    (p) => p.name.toLowerCase() === name.trim().toLowerCase(),
  );
  if (existing) {
    existing.design = design;
    existing.savedAt = Date.now();
  } else {
    presets.push({
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || "Untitled preset",
      savedAt: Date.now(),
      design,
    });
  }
  savePresets(presets);
  return presets;
}

export function deletePreset(id: string): SavedPreset[] {
  const next = loadPresets().filter((p) => p.id !== id);
  savePresets(next);
  return next;
}

export function applyPreset(preset: SavedPreset): DesignState {
  return {
    ...DEFAULT_DESIGN,
    ...preset.design,
    text: { ...DEFAULT_DESIGN.text, ...preset.design.text },
    graphics: preset.design.graphics ?? DEFAULT_DESIGN.graphics,
  };
}
