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
import ReviewPanel from "./editor/ReviewPanel";
import { FLOW_STEPS, type FlowStep } from "./editor/flow";

function isAcceptedFile(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === "image/png" || t === "image/jpeg" || t === "image/webp")
    return true;
  return /\.(png|jpe?g|webp)$/i.test(file.name);
}

const LAYOUTS: { id: DeviceLayout; label: string; hint: string }[] = [
  { id: "single", label: "Single", hint: "One device" },
  { id: "dual-side", label: "Side by side", hint: "Two phones" },
  { id: "dual-overlap", label: "Overlap", hint: "Stacked depth" },
  { id: "dual-angled", label: "Tilted", hint: "Angled pair" },
  { id: "foldable-open", label: "Foldable open", hint: "MIT Duo open" },
  { id: "foldable-closed", label: "Foldable closed", hint: "MIT Duo cover" },
];

export default function EditorApp() {
  const [step, setStep] = useState<FlowStep>("upload");
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
  const [analyzeToken, setAnalyzeToken] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
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
      selectedSizes.find((s) => s.platform === "dual") ??
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

  const clearResults = useCallback(() => {
    setResults((prev) => {
      revokeResults(prev);
      return [];
    });
  }, []);

  const patchDesign = useCallback(
    (partial: Partial<DesignState>) => {
      startTransition(() => {
        setDesign((d) => ({ ...d, ...partial }));
      });
      clearResults();
    },
    [clearResults],
  );

  const patchText = useCallback(
    (partial: Partial<DesignState["text"]>) => {
      startTransition(() => {
        setDesign((d) => ({
          ...d,
          text: { ...d.text, ...partial },
        }));
      });
      clearResults();
    },
    [clearResults],
  );

  const addFiles = useCallback(
    async (list: FileList | File[]) => {
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
        clearResults();
        setStep("devices");
        setAnalyzeToken((n) => n + 1);
      } catch {
        setError("Could not read one or more images. Try a different file.");
      }
    },
    [activeSourceId, clearResults],
  );

  const removeSource = useCallback(
    (id: string) => {
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
    },
    [activeSourceId],
  );

  const reorderSources = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setSources((prev) => {
      const from = prev.findIndex((s) => s.id === fromId);
      const to = prev.findIndex((s) => s.id === toId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (!item) return prev;
      next.splice(to, 0, item);
      return next;
    });
    clearResults();
  }, [clearResults]);

  const clearAll = useCallback(() => {
    setSources((prev) => {
      prev.forEach(revokeSource);
      return [];
    });
    setActiveSourceId(null);
    clearResults();
    setProgress({ done: 0, total: 0 });
    setError(null);
    setStep("upload");
  }, [clearResults]);

  const togglePlatform = useCallback((id: PlatformId) => {
    setPlatforms((prev) =>
      prev.includes(id)
        ? prev.length === 1
          ? prev
          : prev.filter((p) => p !== id)
        : [...prev, id],
    );
    clearResults();
  }, [clearResults]);

  const setBgKind = useCallback(
    (kind: BackgroundKind) => {
      if (kind === "solid") {
        patchDesign({
          background: {
            kind: "solid",
            color:
              design.background.kind === "solid"
                ? design.background.color
                : design.background.kind === "image"
                  ? design.background.fallbackColor
                  : "#0a0f14",
          },
        });
        return;
      }
      if (kind === "gradient") {
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
        return;
      }
      patchDesign({
        background: {
          kind: "image",
          imageDataUrl:
            design.background.kind === "image"
              ? design.background.imageDataUrl
              : "",
          fallbackColor:
            design.background.kind === "image"
              ? design.background.fallbackColor
              : design.background.kind === "solid"
                ? design.background.color
                : "#0a0f14",
        },
      });
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
      clearResults();
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
  }, [sources, selectedSizes, design, jobCount, clearResults]);

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
  const hasSources = sources.length > 0;

  const goNext = () => {
    const order = FLOW_STEPS.map((s) => s.id);
    const i = order.indexOf(step);
    if (i < order.length - 1) setStep(order[i + 1]!);
  };
  const goBack = () => {
    const order = FLOW_STEPS.map((s) => s.id);
    const i = order.indexOf(step);
    if (i > 0) setStep(order[i - 1]!);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] px-6 py-7 sm:px-10 sm:py-9">
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
          <h1 className="mt-2 text-lg font-medium text-[var(--ink-soft)] sm:text-xl">
            Guided App Store screenshot studio
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--muted)]">
            Upload → devices → style → AI review → export. Dual iPhone layouts
            across every iPhone size, plus an MIT-licensed foldable Duo frame.
          </p>
        </div>
      </header>

      <nav
        aria-label="Guided workflow"
        className="flex gap-1.5 overflow-x-auto rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-2"
      >
        {FLOW_STEPS.map((s, i) => {
          const active = step === s.id;
          const locked =
            s.id !== "upload" && !hasSources;
          return (
            <button
              key={s.id}
              type="button"
              disabled={locked}
              onClick={() => setStep(s.id)}
              className={`flex min-h-[48px] min-w-[7.5rem] flex-1 items-center gap-2.5 rounded-[0.9rem] px-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                active
                  ? "bg-[var(--ink)] text-white"
                  : "text-[var(--ink-soft)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface-muted)] text-[var(--muted)]"
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {s.label}
                </span>
                <span
                  className={`block truncate text-[11px] ${active ? "text-white/70" : "text-[var(--muted)]"}`}
                >
                  {s.hint}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-[#fff2f2] px-4 py-3 text-sm text-[#b91010]"
        >
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="min-w-0 space-y-5">
          {step === "upload" && (
            <section className="space-y-4 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                  1. Upload screenshots
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Drop PNG/JPEG/WebP. Drag thumbs to reorder — dual layouts pair
                  each shot with the next.
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
                className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed px-6 py-8 text-center transition-colors ${
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
                  or click to browse — multiple files welcome
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
              {sources.length === 0 ? (
                <p className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--muted)]">
                  Empty set — add at least one screenshot to continue.
                </p>
              ) : (
                <ScreenshotStrip
                  sources={sources}
                  activeId={activeSource?.id ?? null}
                  dragId={dragId}
                  onSelect={setActiveSourceId}
                  onRemove={removeSource}
                  onDragStart={setDragId}
                  onDropOn={(id) => {
                    if (dragId) reorderSources(dragId, id);
                    setDragId(null);
                  }}
                />
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!hasSources}
                  onClick={() => setStep("devices")}
                  className="min-h-[48px] rounded-full bg-[var(--accent)] px-6 text-sm font-medium text-white disabled:opacity-40"
                >
                  Continue to devices
                </button>
              </div>
            </section>
          )}

          {step === "devices" && (
            <section className="space-y-5 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                  2. Devices & layout
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Dual compositions are first-class on every iPhone ASC size.
                  Foldable uses the MIT Duo bezel from bunlongheng/frames.
                </p>
              </div>

              <ScreenshotStrip
                sources={sources}
                activeId={activeSource?.id ?? null}
                dragId={dragId}
                onSelect={setActiveSourceId}
                onRemove={removeSource}
                onDragStart={setDragId}
                onDropOn={(id) => {
                  if (dragId) reorderSources(dragId, id);
                  setDragId(null);
                }}
              />

              <div className="space-y-2">
                <h3 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                  Composition
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={design.layout === l.id}
                      onClick={() => patchDesign({ layout: l.id })}
                      className={`min-h-[64px] rounded-xl px-3 py-2 text-left transition-colors ${
                        design.layout === l.id
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--surface-muted)] text-[var(--ink)] hover:bg-[#dce6e3]"
                      }`}
                    >
                      <span className="block text-sm font-medium">
                        {l.label}
                      </span>
                      <span
                        className={`block text-[11px] ${design.layout === l.id ? "text-white/75" : "text-[var(--muted)]"}`}
                      >
                        {l.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                  Export targets
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {PLATFORMS.map((platform) => {
                    const on = platforms.includes(platform.id);
                    return (
                      <button
                        key={platform.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => togglePlatform(platform.id)}
                        className={`min-h-[52px] rounded-xl px-3 py-2 text-sm font-medium ${
                          on
                            ? "bg-[var(--ink)] text-white"
                            : "bg-[var(--surface-muted)] text-[var(--ink)]"
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
                  {selectedSizes.length} sizes · {jobCount} outputs
                  {design.layout.startsWith("dual")
                    ? " · dual pairs shot N with N+1"
                    : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={design.frames}
                  onClick={() => patchDesign({ frames: !design.frames })}
                  className={`min-h-[44px] rounded-full px-5 text-sm font-medium ${
                    design.frames
                      ? "bg-[var(--ink)] text-white"
                      : "bg-[var(--surface-muted)] text-[var(--ink)]"
                  }`}
                >
                  Frames {design.frames ? "on" : "off"}
                </button>
                {(
                  [
                    { id: "contain" as const, label: "Contain" },
                    { id: "cover" as const, label: "Cover" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={design.mode === item.id}
                    onClick={() => patchDesign({ mode: item.id })}
                    className={`min-h-[44px] rounded-full px-5 text-sm font-medium ${
                      design.mode === item.id
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--surface-muted)] text-[var(--ink)]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--muted)]">
                Screenshots always cover-fill the device screen first; contain/cover
                only scales the framed composition to the ASC canvas.
              </p>

              <FlowNav onBack={goBack} onNext={() => setStep("style")} nextLabel="Continue to style" />
            </section>
          )}

          {step === "style" && (
            <>
              <section className="space-y-4 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                    3. Style
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Captions, type, background, and presets. Live preview stays
                    on the right (below on mobile).
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {LAYOUT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => patchDesign(mergeTemplate(design, tpl))}
                      className="min-h-[60px] rounded-[1rem] border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-left hover:border-[var(--accent-soft)]"
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

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                    Headline
                  </span>
                  <input
                    value={design.text.headline}
                    onChange={(e) => patchText({ headline: e.target.value })}
                    placeholder="Short marketing headline"
                    className="min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-white px-3 text-[15px] outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                    Subtitle
                  </span>
                  <input
                    value={design.text.subtitle}
                    onChange={(e) => patchText({ subtitle: e.target.value })}
                    placeholder="Supporting line"
                    className="min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-white px-3 text-[15px] outline-none focus:border-[var(--accent)]"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                      Font
                    </span>
                    <select
                      value={design.text.fontId}
                      onChange={(e) => patchText({ fontId: e.target.value })}
                      className="min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-white px-3 text-[15px]"
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
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
                    <span className="text-xs text-[var(--muted)]">
                      Headline {design.text.headlineSize}px
                    </span>
                    <input
                      type="range"
                      min={28}
                      max={120}
                      value={design.text.headlineSize}
                      onChange={(e) =>
                        patchText({ headlineSize: Number(e.target.value) })
                      }
                      className="w-full"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs text-[var(--muted)]">
                      Subtitle {design.text.subtitleSize}px
                    </span>
                    <input
                      type="range"
                      min={16}
                      max={64}
                      value={design.text.subtitleSize}
                      onChange={(e) =>
                        patchText({ subtitleSize: Number(e.target.value) })
                      }
                      className="w-full"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-[var(--muted)]">Color</span>
                    <input
                      type="color"
                      value={design.text.color}
                      onChange={(e) => patchText({ color: e.target.value })}
                      className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--line)] bg-white p-1"
                    />
                  </label>
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
                      onClick={() => patchText({ align: id })}
                      className={`min-h-[40px] rounded-full px-3 text-sm ${
                        design.text.align === id
                          ? "bg-[var(--ink)] text-white"
                          : "bg-[var(--surface-muted)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  {(
                    [
                      ["top", "Top"],
                      ["bottom", "Bottom"],
                    ] as [TextPosition, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => patchText({ position: id })}
                      className={`min-h-[40px] rounded-full px-3 text-sm ${
                        design.text.position === id
                          ? "bg-[var(--ink)] text-white"
                          : "bg-[var(--surface-muted)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs text-[var(--muted)]">
                    Edge inset {design.text.insetPercent}%
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
              </section>

              <section className="space-y-4 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
                <h3 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                  Background
                </h3>
                <div className="inline-flex rounded-xl bg-[var(--surface-muted)] p-1">
                  {(
                    [
                      { id: "solid", label: "Solid" },
                      { id: "gradient", label: "Gradient" },
                      { id: "image", label: "Image" },
                    ] as const
                  ).map((kind) => (
                    <button
                      key={kind.id}
                      type="button"
                      onClick={() => setBgKind(kind.id)}
                      className={`min-h-[40px] rounded-lg px-4 text-sm font-medium ${
                        design.background.kind === kind.id
                          ? "bg-white shadow-sm"
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
                  <div className="flex flex-wrap gap-2">
                    {SOLID_PRESETS.map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        title={preset.label}
                        onClick={() =>
                          patchDesign({
                            background: { kind: "solid", color: preset.color },
                          })
                        }
                        className="h-10 w-10 rounded-full border-2 border-[var(--line)]"
                        style={{ backgroundColor: preset.color }}
                      />
                    ))}
                    <input
                      type="color"
                      value={design.background.color}
                      onChange={(e) =>
                        patchDesign({
                          background: { kind: "solid", color: e.target.value },
                        })
                      }
                      className="h-10 w-14 rounded-lg border border-[var(--line)] bg-white p-1"
                    />
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
                          className="h-10 min-w-[72px] rounded-xl px-2 text-[11px] font-medium text-white"
                          style={{
                            background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
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
                          className={`min-h-[36px] rounded-full px-3 text-xs ${
                            design.background.kind === "gradient" &&
                            design.background.direction === dir.id
                              ? "bg-[var(--ink)] text-white"
                              : "bg-[var(--surface-muted)]"
                          }`}
                        >
                          {dir.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {design.background.kind === "image" && (
                  <p className="text-sm text-[var(--muted)]">
                    {design.background.imageDataUrl
                      ? "AI background applied — regenerate in AI review."
                      : "No image yet — generate one in the AI review step."}
                  </p>
                )}
              </section>

              <section className="space-y-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
                <h3 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                  Presets
                </h3>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name"
                    className="min-h-[44px] min-w-[140px] flex-1 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={saveCurrentPreset}
                    className="min-h-[44px] rounded-full bg-[var(--accent)] px-5 text-sm font-medium text-white"
                  >
                    Save
                  </button>
                </div>
                {presets.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    No saved presets yet (stored in localStorage).
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {presets.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2"
                      >
                        <button
                          type="button"
                          className="text-sm font-medium"
                          onClick={() => patchDesign(applyPreset(p))}
                        >
                          {p.name}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-[var(--muted)]"
                          onClick={() => setPresets(deletePreset(p.id))}
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <FlowNav onBack={goBack} onNext={() => setStep("review")} nextLabel="Continue to AI review" />
            </>
          )}

          {step === "review" && (
            <section className="space-y-4">
              <div className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
                <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                  4. AI review
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Multilingual copy, layout pick, backgrounds, and a scorecard
                  with one-click fixes — via Vercel AI Gateway when configured.
                </p>
              </div>
              <ReviewPanel
                source={activeSource}
                sourcesCount={sources.length}
                design={design}
                onPatchDesign={patchDesign}
                onPatchText={patchText}
                platforms={platforms}
                onSetPlatforms={(next) => {
                  setPlatforms(next);
                  clearResults();
                }}
                analyzeToken={analyzeToken}
              />
              <FlowNav
                onBack={goBack}
                onNext={() => setStep("export")}
                nextLabel="Continue to export"
              />
            </section>
          )}

          {step === "export" && (
            <section className="space-y-4 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                  5. Export
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Batch = every screenshot × every selected ASC size as opaque
                  PNGs.
                </p>
              </div>

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
                  className="min-h-[52px] rounded-full bg-[var(--accent)] px-8 text-[16px] font-medium text-white disabled:opacity-40"
                >
                  {busy ? `Exporting… ${pct}%` : "Export all selected"}
                </button>
                <button
                  type="button"
                  disabled={busy || results.length === 0}
                  onClick={() => void downloadZip(results)}
                  className="min-h-[52px] rounded-full bg-[var(--ink)] px-8 text-[16px] font-medium text-white disabled:opacity-40"
                >
                  Download ZIP
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={clearAll}
                  className="min-h-[52px] rounded-full px-6 text-[16px] font-medium text-[var(--accent)]"
                >
                  Clear all
                </button>
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
                    className="h-full rounded-full bg-[var(--accent)] transition-[width]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              {!busy && results.length === 0 && (
                <p className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--muted)]">
                  No exports yet — run Export to generate PNGs.
                </p>
              )}

              {results.length > 0 && (
                <div className="space-y-6">
                  <p className="text-sm text-[var(--muted)]">
                    {results.length} opaque PNG
                    {results.length === 1 ? "" : "s"} ready.
                  </p>
                  {grouped.map((group) => (
                    <div key={group.id} className="space-y-3">
                      <h3 className="text-[15px] font-semibold text-[var(--ink)]">
                        {group.label}
                      </h3>
                      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {group.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex flex-col overflow-hidden rounded-[1.1rem] border border-[var(--line)] bg-[var(--surface)]"
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
                              <p className="text-[13px] font-medium text-[var(--ink)]">
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
                </div>
              )}

              <FlowNav onBack={goBack} onNext={goNext} hideNext />
            </section>
          )}

          <ComingSoon />

          <footer className="border-t border-[var(--line)] pt-5 text-xs leading-relaxed text-[var(--muted)]">
            Dual iPhone layouts export at every iPhone ASC size. Foldable frame:
            MIT{" "}
            <a
              href="https://github.com/bunlongheng/frames"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              bunlongheng/frames
            </a>
            . AI via Vercel AI Gateway (
            <code>AI_GATEWAY_API_KEY</code> / OIDC) with optional{" "}
            <code>XAI_API_KEY</code> fallback.
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

function FlowNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  hideNext,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  hideNext?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-between gap-3 pt-2">
      <button
        type="button"
        onClick={onBack}
        className="min-h-[44px] rounded-full px-5 text-sm font-medium text-[var(--ink-soft)] hover:bg-[var(--surface-muted)]"
      >
        Back
      </button>
      {!hideNext && (
        <button
          type="button"
          onClick={onNext}
          className="min-h-[44px] rounded-full bg-[var(--accent)] px-6 text-sm font-medium text-white"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}

function ScreenshotStrip({
  sources,
  activeId,
  dragId,
  onSelect,
  onRemove,
  onDragStart,
  onDropOn,
}: {
  sources: SourceImage[];
  activeId: string | null;
  dragId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDragStart: (id: string) => void;
  onDropOn: (id: string) => void;
}) {
  if (sources.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-3">
      {sources.map((source, index) => {
        const selected = source.id === activeId;
        return (
          <li
            key={source.id}
            className={`relative w-[96px] ${dragId === source.id ? "opacity-50" : ""}`}
            draggable
            onDragStart={() => onDragStart(source.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onDropOn(source.id);
            }}
          >
            <button
              type="button"
              onClick={() => onSelect(source.id)}
              className={`block w-full overflow-hidden bg-[var(--surface-muted)] ${
                selected ? "ring-2 ring-[var(--accent)] ring-offset-2" : ""
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
              onClick={() => onRemove(source.id)}
              className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-sm text-white"
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}
