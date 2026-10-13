"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import {
  DEFAULT_PLATFORMS,
  PLATFORMS,
  sizesForPlatforms,
  type PlatformId,
  type ScreenshotSize,
} from "@/lib/sizes";
import {
  generateAll,
  loadSourceImage,
  revokeResults,
  revokeSource,
  type GeneratedResult,
  type SourceImage,
} from "@/lib/resize";
import {
  SOLID_PRESETS,
  GRADIENT_PRESETS,
  GRADIENT_DIRECTIONS,
  cssBackgroundPreview,
  type Background,
  type BackgroundKind,
} from "@/lib/background";
import {
  DEFAULT_DESIGN,
  LAYOUT_TEMPLATES,
  mergeTemplate,
  snapInset,
  type DesignState,
  type DeviceLayout,
  type TextAlign,
  type TextPosition,
} from "@/lib/design";
import { FONT_OPTIONS } from "@/lib/fonts";
import {
  applyPreset,
  deletePreset,
  loadPresets,
  upsertPreset,
  type SavedPreset,
} from "@/lib/presets";
import { downloadBlob, downloadZip } from "@/lib/download";
import { formatSize } from "@/lib/sizes";
import LivePreview from "./editor/LivePreview";
import ComingSoon from "./editor/ComingSoon";

type Step = "upload" | "design" | "export";

function isAcceptedFile(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === "image/png" || t === "image/jpeg" || t === "image/webp")
    return true;
  return /\.(png|jpe?g|webp)$/i.test(file.name);
}

const STEPS: { id: Step; label: string; hint: string }[] = [
  { id: "upload", label: "Upload", hint: "Add screenshots" },
  { id: "design", label: "Design", hint: "Style the set" },
  { id: "export", label: "Export", hint: "ASC sizes + ZIP" },
];

const LAYOUTS: { id: DeviceLayout; label: string }[] = [
  { id: "single", label: "Single" },
  { id: "dual-side", label: "Side by side" },
  { id: "dual-overlap", label: "Overlap" },
  { id: "dual-angled", label: "Angled" },
];

export default function EditorApp() {
  const [step, setStep] = useState<Step>("upload");
  const [sources, setSources] = useState<SourceImage[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [platforms, setPlatforms] =
    useState<PlatformId[]>(DEFAULT_PLATFORMS);
  const [design, setDesign] = useState<DesignState>(DEFAULT_DESIGN);
  const [previewSizeId, setPreviewSizeId] = useState<string | null>(null);
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [presets, setPresets] = useState<SavedPreset[]>(() => loadPresets());
  const [presetName, setPresetName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSizes = useMemo(
    () => sizesForPlatforms(platforms),
    [platforms],
  );
  const jobCount = sources.length * selectedSizes.length;
  const activeSource =
    sources.find((s) => s.id === activeSourceId) ?? sources[0] ?? null;
  const secondarySource = useMemo(() => {
    if (sources.length < 2) return activeSource;
    const idx = sources.findIndex((s) => s.id === activeSource?.id);
    return sources[(idx + 1) % sources.length] ?? activeSource;
  }, [sources, activeSource]);

  const previewSize: ScreenshotSize | null = useMemo(() => {
    if (selectedSizes.length === 0) return null;
    return (
      selectedSizes.find((s) => s.id === previewSizeId) ??
      selectedSizes.find((s) => s.platform === "iphone") ??
      selectedSizes[0] ??
      null
    );
  }, [selectedSizes, previewSizeId]);

  useEffect(
    () => () => {
      setSources((prev) => {
        prev.forEach(revokeSource);
        return prev;
      });
      setResults((prev) => {
        revokeResults(prev);
        return prev;
      });
    },
    [],
  );

  const patchDesign = useCallback(( partial: Partial<DesignState>) => {
    startTransition(() => {
      setDesign((d) => ({ ...d, ...partial }));
    });
    setResults((prev) => {
      revokeResults(prev);
      return [];
    });
  }, []);

  const patchText = useCallback(
    (partial: Partial<DesignState["text"]>) => {
      startTransition(() => {
        setDesign((d) => ({
          ...d,
          text: { ...d.text, ...partial },
        }));
      });
      setResults((prev) => {
        revokeResults(prev);
        return [];
      });
    },
    [],
  );

  const addFiles = useCallback(async (list: FileList | File[]) => {
    setError(null);
    const files = Array.from(list).filter(isAcceptedFile);
    if (files.length === 0) {
      setError("Please choose PNG, JPEG, or WebP images.");
      return;
    }
    try {
      const loaded = await Promise.all(files.map(loadSourceImage));
      setSources((prev) => {
        const next = [...prev, ...loaded];
        if (!activeSourceId && next[0]) setActiveSourceId(next[0].id);
        return next;
      });
      setResults((prev) => {
        revokeResults(prev);
        return [];
      });
      setStep("design");
    } catch {
      setError("Could not read one or more images. Try a different file.");
    }
  }, [activeSourceId]);

  const removeSource = useCallback((id: string) => {
    setSources((prev) => {
      const next = prev.filter((s) => s.id !== id);
      const removed = prev.find((s) => s.id === id);
      if (removed) revokeSource(removed);
      if (activeSourceId === id) setActiveSourceId(next[0]?.id ?? null);
      return next;
    });
    setResults((prev) => {
      const keep = prev.filter((r) => r.sourceId !== id);
      revokeResults(prev.filter((r) => r.sourceId === id));
      return keep;
    });
  }, [activeSourceId]);

  const clearAll = useCallback(() => {
    setSources((prev) => {
      prev.forEach(revokeSource);
      return [];
    });
    setActiveSourceId(null);
    setResults((prev) => {
      revokeResults(prev);
      return [];
    });
    setProgress({ done: 0, total: 0 });
    setError(null);
    setStep("upload");
  }, []);

  const togglePlatform = useCallback((id: PlatformId) => {
    setPlatforms((prev) =>
      prev.includes(id)
        ? prev.length === 1
          ? prev
          : prev.filter((p) => p !== id)
        : [...prev, id],
    );
    setResults((prev) => {
      revokeResults(prev);
      return [];
    });
  }, []);

  const setBgKind = useCallback(
    (kind: BackgroundKind) => {
      if (kind === "solid") {
        patchDesign({
          background: {
            kind: "solid",
            color:
              design.background.kind === "solid"
                ? design.background.color
                : "#0a0f14",
          },
        });
      } else {
        patchDesign({
          background: {
            kind: "gradient",
            from:
              design.background.kind === "gradient"
                ? design.background.from
                : "#0b3d3a",
            to:
              design.background.kind === "gradient"
                ? design.background.to
                : "#0a0f14",
            direction:
              design.background.kind === "gradient"
                ? design.background.direction
                : "vertical",
          },
        });
      }
    },
    [design.background, patchDesign],
  );

  const runGenerate = useCallback(async () => {
    if (sources.length === 0 || selectedSizes.length === 0) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: jobCount });
    setStep("export");
    try {
      setResults((prev) => {
        revokeResults(prev);
        return [];
      });
      const generated = await generateAll({
        sources,
        sizes: selectedSizes,
        mode: design.mode,
        background: design.background,
        frames: design.frames,
        design,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResults(generated);
    } catch {
      setError("Export failed. Try fewer images or smaller sources.");
    } finally {
      setBusy(false);
    }
  }, [sources, selectedSizes, design, jobCount]);

  const saveCurrentPreset = useCallback(() => {
    const name = presetName.trim() || `Preset ${presets.length + 1}`;
    const next = upsertPreset(name, design);
    setPresets(next);
    setPresetName("");
  }, [presetName, presets.length, design]);

  const grouped = useMemo(() => {
    const map = new Map<PlatformId, GeneratedResult[]>();
    for (const result of results) {
      const list = map.get(result.size.platform) ?? [];
      list.push(result);
      map.set(result.size.platform, list);
    }
    return PLATFORMS.filter((p) => map.has(p.id)).map((p) => ({
      ...p,
      items: map.get(p.id)!,
    }));
  }, [results]);

  const pct =
    progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;
  const bgPreview = cssBackgroundPreview(design.background);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-8 sm:px-6 lg:py-10">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] px-6 py-8 sm:px-10 sm:py-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 100% 0%, rgba(15,118,110,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 0% 100%, rgba(20,184,166,0.12), transparent 50%), linear-gradient(135deg, #f4f8f7 0%, #e8f0ef 50%, #f7faf9 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute -right-8 top-4 h-40 w-40 rounded-full border border-teal-700/10"
          style={{ animation: "asc-float 8s ease-in-out infinite" }}
        />
        <div className="relative z-[1] max-w-2xl">
          <p className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-[var(--ink)] sm:text-5xl">
            ASC Studio
          </p>
          <h1 className="mt-3 text-xl font-medium text-[var(--ink-soft)] sm:text-2xl">
            App Store screenshots, headers & search creatives
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
            Upload a set, design once, export every selected App Store Connect
            size — frames, dual iPhones, product-page headers, and search
            imagery — entirely in your browser.
          </p>
        </div>
      </header>

      <nav
        aria-label="Workflow"
        className="flex flex-wrap gap-2 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-2"
      >
        {STEPS.map((s, i) => {
          const active = step === s.id;
          const locked =
            (s.id === "design" || s.id === "export") && sources.length === 0;
          return (
            <button
              key={s.id}
              type="button"
              disabled={locked}
              onClick={() => setStep(s.id)}
              className={`flex min-h-[52px] flex-1 items-center gap-3 rounded-[1rem] px-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? "bg-[var(--ink)] text-white"
                  : "text-[var(--ink-soft)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface-muted)] text-[var(--muted)]"
                }`}
              >
                {i + 1}
              </span>
              <span>
                <span className="block text-[15px] font-medium">{s.label}</span>
                <span
                  className={`block text-xs ${active ? "text-white/70" : "text-[var(--muted)]"}`}
                >
                  {s.hint}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div className="min-w-0 space-y-6">
          {(step === "upload" || step === "design") && (
            <section
              aria-labelledby="upload-heading"
              className="space-y-4 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5"
            >
              <div>
                <h2
                  id="upload-heading"
                  className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]"
                >
                  Screenshot set
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Manage several shots as one set — style applies consistently;
                  dual layouts pair each shot with the next.
                </p>
              </div>
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.length)
                    void addFiles(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed px-6 py-8 text-center transition-colors ${
                  dragOver
                    ? "border-[var(--accent)] bg-teal-50/60"
                    : "border-[var(--line)] bg-[var(--surface-muted)] hover:border-[var(--accent-soft)]"
                }`}
                style={{ borderRadius: "1.1rem" }}
              >
                <span className="text-[16px] font-medium text-[var(--ink)]">
                  Drop screenshots here
                </span>
                <span className="text-sm text-[var(--muted)]">
                  PNG, JPEG, or WebP — multiple files welcome
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) void addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
              {sources.length > 0 && (
                <ul className="flex flex-wrap gap-3">
                  {sources.map((source, index) => {
                    const selected = source.id === activeSource?.id;
                    return (
                      <li key={source.id} className="relative w-[96px]">
                        <button
                          type="button"
                          onClick={() => setActiveSourceId(source.id)}
                          className={`block w-full overflow-hidden bg-[var(--surface-muted)] ${
                            selected
                              ? "ring-2 ring-[var(--accent)] ring-offset-2"
                              : ""
                          }`}
                          style={{ borderRadius: "0.85rem" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={source.previewUrl}
                            alt={source.name}
                            className="aspect-[9/16] w-full object-cover"
                          />
                          <span className="block truncate px-1.5 py-1 text-[10px] text-[var(--muted)]">
                            {index + 1}. {source.name}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${source.name}`}
                          onClick={() => removeSource(source.id)}
                          className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-sm text-white"
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {step === "design" && (
            <>
              <section className="space-y-4 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
                <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                  Templates
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {LAYOUT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() =>
                        patchDesign(mergeTemplate(design, tpl))
                      }
                      className="min-h-[64px] rounded-[1rem] border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-left transition-colors hover:border-[var(--accent-soft)]"
                    >
                      <span className="block text-sm font-medium text-[var(--ink)]">
                        {tpl.label}
                      </span>
                      <span className="block text-xs text-[var(--muted)]">
                        {tpl.description}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
                <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                  Caption & type
                </h2>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                    Headline
                  </span>
                  <input
                    value={design.text.headline}
                    onChange={(e) =>
                      patchText({ headline: e.target.value })
                    }
                    placeholder="Short marketing headline"
                    className="min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-white px-3 text-[15px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                    Subtitle
                  </span>
                  <input
                    value={design.text.subtitle}
                    onChange={(e) =>
                      patchText({ subtitle: e.target.value })
                    }
                    placeholder="Supporting line"
                    className="min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-white px-3 text-[15px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                      Font
                    </span>
                    <select
                      value={design.text.fontId}
                      onChange={(e) =>
                        patchText({ fontId: e.target.value })
                      }
                      className="min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-white px-3 text-[15px]"
                    >
                      <optgroup label="Bundled Google fonts">
                        {FONT_OPTIONS.filter((f) => f.kind === "google").map(
                          (f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ),
                        )}
                      </optgroup>
                      <optgroup label="Web-safe">
                        {FONT_OPTIONS.filter((f) => f.kind === "websafe").map(
                          (f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ),
                        )}
                      </optgroup>
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                      Weight
                    </span>
                    <select
                      value={design.text.weight}
                      onChange={(e) =>
                        patchText({
                          weight: Number(e.target.value) as DesignState["text"]["weight"],
                        })
                      }
                      className="min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-white px-3 text-[15px]"
                    >
                      {[400, 500, 600, 700, 800].map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                      Headline size
                    </span>
                    <input
                      type="range"
                      min={28}
                      max={120}
                      value={design.text.headlineSize}
                      onChange={(e) =>
                        patchText({
                          headlineSize: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                    <span className="text-xs text-[var(--muted)]">
                      {design.text.headlineSize}px
                    </span>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                      Subtitle size
                    </span>
                    <input
                      type="range"
                      min={16}
                      max={64}
                      value={design.text.subtitleSize}
                      onChange={(e) =>
                        patchText({
                          subtitleSize: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                    <span className="text-xs text-[var(--muted)]">
                      {design.text.subtitleSize}px
                    </span>
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-[var(--muted)]">Color</span>
                    <input
                      type="color"
                      value={design.text.color}
                      onChange={(e) =>
                        patchText({ color: e.target.value })
                      }
                      className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--line)] bg-white p-1"
                    />
                  </label>
                  <div
                    role="group"
                    aria-label="Alignment"
                    className="inline-flex rounded-xl bg-[var(--surface-muted)] p-1"
                  >
                    {(
                      [
                        ["left", "Left"],
                        ["center", "Center"],
                        ["right", "Right"],
                      ] as [TextAlign, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={design.text.align === id}
                        onClick={() => patchText({ align: id })}
                        className={`min-h-[40px] rounded-lg px-3 text-sm font-medium ${
                          design.text.align === id
                            ? "bg-white text-[var(--ink)] shadow-sm"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div
                    role="group"
                    aria-label="Text position"
                    className="inline-flex rounded-xl bg-[var(--surface-muted)] p-1"
                  >
                    {(
                      [
                        ["top", "Top"],
                        ["bottom", "Bottom"],
                      ] as [TextPosition, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={design.text.position === id}
                        onClick={() => patchText({ position: id })}
                        className={`min-h-[40px] rounded-lg px-3 text-sm font-medium ${
                          design.text.position === id
                            ? "bg-white text-[var(--ink)] shadow-sm"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                    Edge inset ({design.text.insetPercent}%)
                    {design.snapEnabled ? " · snap 5%" : ""}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={design.snapEnabled ? 5 : 1}
                    value={design.text.insetPercent}
                    onChange={(e) =>
                      patchText({
                        insetPercent: snapInset(
                          Number(e.target.value),
                          design.snapEnabled,
                        ),
                      })
                    }
                    className="w-full"
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={design.showGuides}
                    onClick={() =>
                      patchDesign({ showGuides: !design.showGuides })
                    }
                    className={`min-h-[40px] rounded-full px-4 text-sm font-medium ${
                      design.showGuides
                        ? "bg-[var(--ink)] text-white"
                        : "bg-[var(--surface-muted)] text-[var(--ink)]"
                    }`}
                  >
                    Alignment guides
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={design.snapEnabled}
                    onClick={() =>
                      patchDesign({ snapEnabled: !design.snapEnabled })
                    }
                    className={`min-h-[40px] rounded-full px-4 text-sm font-medium ${
                      design.snapEnabled
                        ? "bg-[var(--ink)] text-white"
                        : "bg-[var(--surface-muted)] text-[var(--ink)]"
                    }`}
                  >
                    Snap helpers
                  </button>
                </div>
              </section>

              <section className="space-y-4 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
                <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                  Layout & frame
                </h2>
                <div className="flex flex-wrap gap-2">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={design.layout === l.id}
                      onClick={() => patchDesign({ layout: l.id })}
                      className={`min-h-[44px] rounded-full px-4 text-sm font-medium ${
                        design.layout === l.id
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--surface-muted)] text-[var(--ink)]"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={design.frames}
                  onClick={() => patchDesign({ frames: !design.frames })}
                  className={`flex min-h-[48px] w-full items-center justify-between rounded-2xl px-5 text-[15px] font-medium sm:w-auto sm:min-w-[260px] ${
                    design.frames
                      ? "bg-[var(--ink)] text-white"
                      : "bg-[var(--surface-muted)] text-[var(--ink)]"
                  }`}
                >
                  <span>
                    {design.frames ? "Device frames on" : "Device frames off"}
                  </span>
                  <span
                    className={`relative h-7 w-12 rounded-full ${
                      design.frames ? "bg-[var(--accent)]" : "bg-[#c5cdcb]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                        design.frames ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                </button>
                <div
                  role="group"
                  aria-label="Resize mode"
                  className="inline-flex rounded-xl bg-[var(--surface-muted)] p-1"
                >
                  {(
                    [
                      {
                        id: "contain" as const,
                        label: "Contain",
                        hint: "Fit device, pad canvas",
                      },
                      {
                        id: "cover" as const,
                        label: "Cover",
                        hint: "Fill canvas, may crop",
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={design.mode === item.id}
                      onClick={() => patchDesign({ mode: item.id })}
                      className={`min-h-[48px] rounded-lg px-4 py-2 text-left ${
                        design.mode === item.id
                          ? "bg-white text-[var(--ink)] shadow-sm"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      <span className="block text-sm font-medium">
                        {item.label}
                      </span>
                      <span className="block text-xs opacity-80">
                        {item.hint}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Screenshots always cover-fill the device screen hole first;
                  contain/cover only scales the framed composition to the ASC
                  canvas.
                </p>
              </section>

              <section className="space-y-4 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
                <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                  Background
                </h2>
                <div
                  role="group"
                  aria-label="Background type"
                  className="inline-flex rounded-xl bg-[var(--surface-muted)] p-1"
                >
                  {(
                    [
                      { id: "solid", label: "Solid" },
                      { id: "gradient", label: "Gradient" },
                    ] as const
                  ).map((kind) => (
                    <button
                      key={kind.id}
                      type="button"
                      aria-pressed={design.background.kind === kind.id}
                      onClick={() => setBgKind(kind.id)}
                      className={`min-h-[44px] rounded-lg px-5 text-sm font-medium ${
                        design.background.kind === kind.id
                          ? "bg-white text-[var(--ink)] shadow-sm"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      {kind.label}
                    </button>
                  ))}
                </div>
                <div
                  className="h-12 w-full rounded-2xl border border-[var(--line)]"
                  style={{ background: bgPreview }}
                  aria-hidden
                />
                {design.background.kind === "solid" && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {SOLID_PRESETS.map((preset) => (
                        <button
                          key={preset.color}
                          type="button"
                          title={preset.label}
                          aria-label={preset.label}
                          onClick={() =>
                            patchDesign({
                              background: {
                                kind: "solid",
                                color: preset.color,
                              },
                            })
                          }
                          className={`h-10 w-10 rounded-full border-2 ${
                            design.background.kind === "solid" &&
                            design.background.color === preset.color
                              ? "border-[var(--accent)]"
                              : "border-[var(--line)]"
                          }`}
                          style={{ backgroundColor: preset.color }}
                        />
                      ))}
                    </div>
                    <label className="flex items-center gap-3 text-sm">
                      <span className="text-[var(--muted)]">Custom</span>
                      <input
                        type="color"
                        value={
                          design.background.kind === "solid"
                            ? design.background.color
                            : "#000000"
                        }
                        onChange={(e) =>
                          patchDesign({
                            background: {
                              kind: "solid",
                              color: e.target.value,
                            },
                          })
                        }
                        className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--line)] bg-white p-1"
                      />
                    </label>
                  </div>
                )}
                {design.background.kind === "gradient" && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {GRADIENT_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            patchDesign({
                              background: {
                                kind: "gradient",
                                from: preset.from,
                                to: preset.to,
                                direction: preset.direction,
                              },
                            })
                          }
                          className="h-10 min-w-[72px] rounded-xl border border-[var(--line)] px-2 text-[11px] font-medium text-white"
                          style={{
                            background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-[var(--muted)]">From</span>
                        <input
                          type="color"
                          value={design.background.from}
                          onChange={(e) =>
                            patchDesign({
                              background: {
                                ...design.background,
                                kind: "gradient",
                                from: e.target.value,
                              } as Background,
                            })
                          }
                          className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--line)] bg-white p-1"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-[var(--muted)]">To</span>
                        <input
                          type="color"
                          value={design.background.to}
                          onChange={(e) =>
                            patchDesign({
                              background: {
                                ...design.background,
                                kind: "gradient",
                                to: e.target.value,
                              } as Background,
                            })
                          }
                          className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--line)] bg-white p-1"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {GRADIENT_DIRECTIONS.map((dir) => (
                        <button
                          key={dir.id}
                          type="button"
                          onClick={() =>
                            patchDesign({
                              background: {
                                ...design.background,
                                kind: "gradient",
                                direction: dir.id,
                              } as Background,
                            })
                          }
                          className={`min-h-[40px] rounded-full px-4 text-xs font-medium ${
                            design.background.kind === "gradient" &&
                            design.background.direction === dir.id
                              ? "bg-[var(--ink)] text-white"
                              : "bg-[var(--surface-muted)] text-[var(--ink)]"
                          }`}
                        >
                          {dir.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-4 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
                <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                  Saved presets
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Stored in this browser via localStorage.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name"
                    className="min-h-[44px] min-w-[160px] flex-1 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={saveCurrentPreset}
                    className="min-h-[44px] rounded-full bg-[var(--accent)] px-5 text-sm font-medium text-white"
                  >
                    Save preset
                  </button>
                </div>
                {presets.length > 0 && (
                  <ul className="space-y-2">
                    {presets.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2"
                      >
                        <button
                          type="button"
                          className="text-left text-sm font-medium text-[var(--ink)]"
                          onClick={() => patchDesign(applyPreset(p))}
                        >
                          {p.name}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-[var(--muted)] hover:text-[#b91c1c]"
                          onClick={() => setPresets(deletePreset(p.id))}
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {(step === "export" || step === "design") && (
            <section className="space-y-4 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                  Export targets
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Batch export = every screenshot × every selected ASC size as
                  a ZIP.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {PLATFORMS.map((platform) => {
                  const on = platforms.includes(platform.id);
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePlatform(platform.id)}
                      className={`min-h-[52px] rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                        on
                          ? "bg-[var(--ink)] text-white"
                          : "bg-[var(--surface-muted)] text-[var(--ink)] hover:bg-[#dce6e3]"
                      }`}
                    >
                      <span className="block">{platform.label}</span>
                      <span
                        className={`block text-[10px] ${on ? "text-white/60" : "text-[var(--muted)]"}`}
                      >
                        {platform.group}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[var(--muted)]">
                {selectedSizes.length} sizes ·{" "}
                {sources.length > 0
                  ? `${jobCount} outputs`
                  : "add screenshots to count outputs"}
              </p>
              {selectedSizes.length > 0 && (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                    Preview size
                  </span>
                  <select
                    value={previewSize?.id ?? ""}
                    onChange={(e) => setPreviewSizeId(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
                  >
                    {selectedSizes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.displayName} · {formatSize(s)}
                        {s.note ? ` — ${s.note}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={busy || sources.length === 0 || platforms.length === 0}
                  onClick={() => void runGenerate()}
                  className="min-h-[52px] rounded-full bg-[var(--accent)] px-8 text-[16px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? `Exporting… ${pct}%` : "Export all selected"}
                </button>
                <button
                  type="button"
                  disabled={busy || results.length === 0}
                  onClick={() => void downloadZip(results)}
                  className="min-h-[52px] rounded-full bg-[var(--ink)] px-8 text-[16px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Download ZIP
                </button>
                {sources.length > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={clearAll}
                    className="min-h-[52px] rounded-full px-6 text-[16px] font-medium text-[var(--accent)] disabled:opacity-40"
                  >
                    Clear all
                  </button>
                )}
              </div>
              {busy && (
                <div
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
                >
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-150"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-[#fff2f2] px-4 py-3 text-sm text-[#b91010]"
                >
                  {error}
                </p>
              )}
            </section>
          )}

          {results.length > 0 && step === "export" && (
            <section aria-labelledby="results-heading" className="space-y-6">
              <div>
                <h2
                  id="results-heading"
                  className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]"
                >
                  Results
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {results.length} opaque PNG
                  {results.length === 1 ? "" : "s"} at exact ASC pixel sizes.
                </p>
              </div>
              {grouped.map((group) => (
                <div key={group.id} className="space-y-3">
                  <h3 className="text-[15px] font-semibold text-[var(--ink)]">
                    {group.label}
                  </h3>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {group.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-col overflow-hidden rounded-[1.1rem] bg-[var(--surface)] border border-[var(--line)]"
                      >
                        <div className="flex aspect-[3/4] items-center justify-center bg-[#0c1618]/[10%]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.previewUrl}
                            alt={`${item.size.displayName} ${formatSize(item.size)}`}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="flex flex-1 flex-col gap-1.5 p-3">
                          <p className="text-[13px] font-medium leading-snug text-[var(--ink)]">
                            {item.size.displayName}
                          </p>
                          <p className="text-[11px] text-[var(--muted)]">
                            {formatSize(item.size)}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              downloadBlob(item.blob, item.filename)
                            }
                            className="mt-auto min-h-[40px] rounded-full bg-[var(--surface-muted)] text-[13px] font-medium text-[var(--accent)]"
                          >
                            Download PNG
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          <ComingSoon />

          <footer className="border-t border-[var(--line)] pt-5 text-xs leading-relaxed text-[var(--muted)]">
            Screenshot sizes from{" "}
            <a
              href="https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Apple screenshot specifications
            </a>
            . Header & search sizes from{" "}
            <a
              href="https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications/"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              creative assets specifications
            </a>
            . Search 3:2 exports use the documented maximum (3840×2560).
            Processing stays on your device.
          </footer>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <LivePreview
            source={activeSource}
            secondary={secondarySource}
            size={previewSize}
            design={design}
          />
        </aside>
      </div>
    </div>
  );
}
