"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import ShotPanel, { type ShotView } from "./ShotPanel";
import StylePanel from "./StylePanel";
import ExportPanel from "./ExportPanel";
import StylePresets from "./StylePresets";
import PaywallModal, { openPaywall } from "./PaywallModal";
import { useEntitlements } from "@/lib/billing/use-entitlements";
import { shouldWatermark } from "@/lib/billing/plans";
import { track } from "@/lib/analytics";
import {
  analyzeScreenshot,
  downscaleImageForVision,
  fetchAiStatus,
  generateLocalizedCopy,
} from "@/lib/ai/client";
import {
  CUSTOM_THEME_ID,
  DEFAULT_STYLE,
  resolveTheme,
  themeFromPixels,
  type LayoutId,
  type ShotCopy,
  type StudioStyle,
} from "@/lib/studio/model";
import { exportShot, renderShot, samplePixels } from "@/lib/studio/render";
import { DEFAULT_SIZE_IDS, exportPath, loadDraft, saveDraft, sizeLabel, sizesById } from "@/lib/studio/project";
import { SCREENSHOT_SIZES } from "@/lib/sizes";

interface Shot {
  id: string;
  name: string;
  bitmap: ImageBitmap;
  thumb: string;
  copy: ShotCopy;
  /** Caption is still one of our example lines. */
  example: boolean;
}

const EXAMPLES: ShotCopy[] = [
  { headline: "Everything you need, in one place", subtitle: "" },
  { headline: "Get it done in seconds", subtitle: "" },
  { headline: "Stay in sync everywhere", subtitle: "" },
  { headline: "Make it truly yours", subtitle: "" },
  { headline: "Built for privacy", subtitle: "" },
  { headline: "Start free today", subtitle: "" },
];

function accepted(file: File) {
  return /^image\/(png|jpe?g|webp)$/i.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
}

const PREVIEW_WIDTH = 520;

export default function Studio() {
  const draft = useMemo(() => loadDraft(), []);
  const [shots, setShots] = useState<Shot[]>([]);
  const [style, setStyle] = useState<StudioStyle>(draft?.style ?? DEFAULT_STYLE);
  const [sizeIds, setSizeIds] = useState<string[]>(draft?.sizeIds ?? DEFAULT_SIZE_IDS);
  const [previewSizeId, setPreviewSizeId] = useState<string>((draft?.sizeIds ?? DEFAULT_SIZE_IDS)[0]!);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const copiesByName = useRef<Record<string, ShotCopy>>(draft?.copies ?? {});
  const renderKeys = useRef<Record<string, string>>({});

  const { data: me } = useEntitlements();
  const plan = me?.plan ?? "free";
  const watermark = shouldWatermark(plan);

  useEffect(() => {
    let alive = true;
    fetchAiStatus()
      .then((s) => alive && setAiEnabled(s.enabled))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Auto theme from the first screenshot's dominant color.
  const firstBitmap = shots[0]?.bitmap ?? null;
  const autoTheme = useMemo(() => (firstBitmap ? themeFromPixels(samplePixels(firstBitmap)) : null), [firstBitmap]);
  const theme = useMemo(() => resolveTheme(style, autoTheme), [style, autoTheme]);

  const previewSize = useMemo(
    () => SCREENSHOT_SIZES.find((s) => s.id === previewSizeId) ?? sizesById(sizeIds)[0] ?? SCREENSHOT_SIZES[0]!,
    [previewSizeId, sizeIds],
  );

  // Persist style, sizes, and captions (by file name) on change.
  useEffect(() => {
    for (const s of shots) if (!s.example) copiesByName.current[s.name] = s.copy;
    saveDraft({ style, sizeIds, copies: copiesByName.current });
  }, [style, sizeIds, shots]);

  // Progressive, incremental preview rendering (only shots whose inputs changed).
  useEffect(() => {
    if (!shots.length) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setRendering(true);
      const scale = PREVIEW_WIDTH / previewSize.width;
      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i]!;
        const next = shots[(i + 1) % shots.length]!;
        const key = JSON.stringify([shot.copy, style, theme, previewSize.id, next.id, watermark, shots.length > 1]);
        if (renderKeys.current[shot.id] === key) continue;
        try {
          const { canvas } = await renderShot({
            size: previewSize,
            primary: shot.bitmap,
            secondary: shots.length > 1 ? next.bitmap : null,
            copy: shot.copy,
            style,
            theme,
            scale,
            watermark,
          });
          if (cancelled) return;
          const url = canvas.toDataURL("image/jpeg", 0.9);
          renderKeys.current[shot.id] = key;
          setPreviews((p) => ({ ...p, [shot.id]: url }));
        } catch {
          if (!cancelled) setError("Could not render a preview. Try a different screenshot.");
        }
      }
      if (!cancelled) setRendering(false);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [shots, style, theme, previewSize, watermark]);

  const addFiles = useCallback(async (files: File[]) => {
    setError(null);
    const ok = files.filter(accepted);
    if (!ok.length) {
      setError("Please add PNG, JPEG, or WebP screenshots.");
      return;
    }
    try {
      const loaded = await Promise.all(
        ok.map(async (file): Promise<Shot> => {
          const bitmap = await createImageBitmap(file);
          const saved = copiesByName.current[file.name];
          return {
            id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
            name: file.name,
            bitmap,
            thumb: URL.createObjectURL(file),
            copy: saved ?? { headline: "", subtitle: "" },
            example: !saved,
          };
        }),
      );
      setShots((prev) => {
        const merged = [...prev, ...loaded];
        return merged.map((s, i) => (s.example && !s.copy.headline ? { ...s, copy: EXAMPLES[i % EXAMPLES.length]! } : s));
      });
      setSelectedId((cur) => cur ?? loaded[0]?.id ?? null);
      track("upload", { count: loaded.length });
    } catch {
      setError("Could not read one or more images.");
    }
  }, []);

  const updateCopy = useCallback((id: string, patch: Partial<ShotCopy>) => {
    setShots((prev) => prev.map((s) => (s.id === id ? { ...s, copy: { ...s.copy, ...patch }, example: false } : s)));
  }, []);

  const move = useCallback((id: string, delta: -1 | 1) => {
    setShots((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }, []);

  const reorder = useCallback((fromId: string, toId: string) => {
    setShots((prev) => {
      const from = prev.findIndex((s) => s.id === fromId);
      const to = prev.findIndex((s) => s.id === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setShots((prev) => {
      const gone = prev.find((s) => s.id === id);
      if (gone) {
        gone.bitmap.close();
        URL.revokeObjectURL(gone.thumb);
      }
      return prev.filter((s) => s.id !== id);
    });
    delete renderKeys.current[id];
    setPreviews((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  }, []);

  const writeCaption = useCallback(
    async (id: string) => {
      const shot = shots.find((s) => s.id === id);
      if (!shot) return;
      setAiBusy(id);
      setError(null);
      try {
        const imageDataUrl = await downscaleImageForVision(shot.bitmap);
        const res = await generateLocalizedCopy({ imageDataUrl, locales: ["en"] });
        const en = res.locales[0];
        if (en) updateCopy(id, { headline: en.headline, subtitle: en.subtitle });
      } catch (err) {
        setError(err instanceof Error ? err.message : "AI caption failed.");
      } finally {
        setAiBusy(null);
      }
    },
    [shots, updateCopy],
  );

  const matchStyle = useCallback(async () => {
    const shot = shots[0];
    if (!shot) return;
    setAiBusy("style");
    setError(null);
    try {
      const imageDataUrl = await downscaleImageForVision(shot.bitmap);
      const { suggestions } = await analyzeScreenshot({ imageDataUrl });
      const bg = suggestions.backgroundStyle;
      const from = bg.kind === "gradient" ? bg.from : suggestions.colorPalette.accent;
      const to = bg.kind === "gradient" ? bg.to : bg.color;
      const layoutMap: Record<string, LayoutId> = {
        "dual-side": "duo",
        "dual-overlap": "duo",
        "dual-angled": "tilt",
      };
      setStyle((s) => ({
        ...s,
        themeId: CUSTOM_THEME_ID,
        custom: { from, to },
        layout: layoutMap[suggestions.layout] ?? s.layout,
        caption: { ...s.caption, color: null },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI style match failed.");
    } finally {
      setAiBusy(null);
    }
  }, [shots]);

  const runExport = useCallback(async () => {
    const sizes = sizesById(sizeIds);
    if (!shots.length || !sizes.length) return;
    const examples = shots.filter((s) => s.example).length;
    if (examples && !window.confirm(`${examples} screenshot(s) still use example captions. Export anyway?`)) return;
    const total = shots.length * sizes.length;
    setExporting({ done: 0, total });
    setError(null);
    try {
      const zip = new JSZip();
      let done = 0;
      for (const size of sizes) {
        for (let i = 0; i < shots.length; i++) {
          const shot = shots[i]!;
          const next = shots[(i + 1) % shots.length]!;
          const blob = await exportShot({
            size,
            primary: shot.bitmap,
            secondary: shots.length > 1 ? next.bitmap : null,
            copy: shot.copy,
            style,
            theme,
            watermark,
          });
          zip.file(exportPath(size, i, shot.name), blob);
          done++;
          setExporting({ done, total });
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      const content = await zip.generateAsync({ type: "blob", compression: "STORE" });
      saveAs(content, "app-store-screenshots.zip");
      track("export", { count: total, plan, watermark });
    } catch {
      setError("Export failed. Try fewer sizes at once.");
    } finally {
      setExporting(null);
    }
  }, [shots, sizeIds, style, theme, watermark, plan]);

  const selectedSizes = sizesById(sizeIds);
  const shotViews: ShotView[] = shots.map((s) => ({ id: s.id, name: s.name, thumb: s.thumb, copy: s.copy, example: s.example }));
  const portraitPreview = previewSize.height >= previewSize.width;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6">
      <PaywallModal />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Studio</h1>
          <p className="text-sm text-[var(--muted)]">
            Add screenshots, write one headline each, pick a look. Every size updates together.
          </p>
        </div>
        {aiEnabled && shots.length ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={aiBusy !== null}
              onClick={() => void matchStyle()}
              className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-50"
            >
              {aiBusy === "style" ? "Matching…" : "✨ Match style to my app"}
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-[#fff2f2] px-4 py-3 text-sm text-[#b91010]">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)_300px]">
        <div className="order-1 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
          <ShotPanel
            shots={shotViews}
            selectedId={selectedId}
            aiEnabled={aiEnabled}
            aiBusyId={aiBusy}
            onAdd={(f) => void addFiles(f)}
            onSelect={setSelectedId}
            onCopy={updateCopy}
            onMove={move}
            onReorder={reorder}
            onRemove={remove}
            onAiCaption={(id) => void writeCaption(id)}
          />
        </div>

        <div className="order-2 min-w-0">
          <div className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-muted)]/60 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Preview</span>
              <select
                value={previewSize.id}
                onChange={(e) => setPreviewSizeId(e.target.value)}
                className="min-h-[34px] rounded-lg border border-[var(--line)] bg-white px-2 text-sm"
              >
                {(selectedSizes.length ? selectedSizes : [previewSize]).map((s) => (
                  <option key={s.id} value={s.id}>
                    {sizeLabel(s)}
                  </option>
                ))}
              </select>
              {rendering ? <span className="text-xs text-[var(--muted)]">Rendering…</span> : null}
            </div>
            {shots.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-[var(--line)] text-center text-sm text-[var(--muted)]">
                Your App Store screenshots appear here, side by side, exactly as they&apos;ll export.
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {shots.map((shot, i) => (
                  <button
                    key={shot.id}
                    type="button"
                    onClick={() => setSelectedId(shot.id)}
                    className={`shrink-0 overflow-hidden rounded-xl text-left shadow-md ring-offset-2 transition ${
                      shot.id === selectedId ? "ring-2 ring-[var(--accent)]" : ""
                    }`}
                    style={{ width: portraitPreview ? 240 : 460 }}
                  >
                    {previews[shot.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previews[shot.id]} alt={`Screenshot ${i + 1} preview`} className="block h-auto w-full" />
                    ) : (
                      <div
                        className="animate-pulse bg-[var(--line)]"
                        style={{ aspectRatio: `${previewSize.width} / ${previewSize.height}` }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="order-3 space-y-4 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
          <StylePanel style={style} autoTheme={autoTheme} onChange={setStyle} />
          <ExportPanel
            sizeIds={sizeIds}
            onSizes={(ids) => {
              setSizeIds(ids);
              if (ids.length && !ids.includes(previewSizeId)) setPreviewSizeId(ids[0]!);
            }}
            shotCount={shots.length}
            exporting={exporting}
            watermark={watermark}
            onExport={() => void runExport()}
            onRemoveWatermark={() => openPaywall("watermark")}
          />
          <StylePresets style={style} onApply={setStyle} />
        </div>
      </div>
    </div>
  );
}
