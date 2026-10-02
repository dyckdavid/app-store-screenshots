"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_PLATFORMS,
  PLATFORMS,
  sizesForPlatforms,
  type PlatformId,
} from "@/lib/sizes";
import {
  generateAll,
  loadSourceImage,
  revokeResults,
  revokeSource,
  type FitMode,
  type GeneratedResult,
  type SourceImage,
} from "@/lib/resize";
import {
  DEFAULT_BACKGROUND,
  cssBackgroundPreview,
  type Background,
  type BackgroundKind,
} from "@/lib/background";
import ResizerPanelTop from "./resizer/ResizerPanelTop";
import ResizerPanelBottom from "./resizer/ResizerPanelBottom";

function isAcceptedFile(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === "image/png" || t === "image/jpeg" || t === "image/webp")
    return true;
  return /\.(png|jpe?g|webp)$/i.test(file.name);
}

function clearResults(
  setResults: React.Dispatch<React.SetStateAction<GeneratedResult[]>>,
) {
  setResults((prev) => {
    revokeResults(prev);
    return [];
  });
}

export default function ResizerApp() {
  const [sources, setSources] = useState<SourceImage[]>([]);
  const [platforms, setPlatforms] =
    useState<PlatformId[]>(DEFAULT_PLATFORMS);
  const [mode, setMode] = useState<FitMode>("contain");
  const [background, setBackground] =
    useState<Background>(DEFAULT_BACKGROUND);
  const [frames, setFrames] = useState(true);
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSizes = useMemo(
    () => sizesForPlatforms(platforms),
    [platforms],
  );
  const jobCount = sources.length * selectedSizes.length;

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

  const addFiles = useCallback(async (list: FileList | File[]) => {
    setError(null);
    const files = Array.from(list).filter(isAcceptedFile);
    if (files.length === 0) {
      setError("Please choose PNG, JPEG, or WebP images.");
      return;
    }
    try {
      const loaded = await Promise.all(files.map(loadSourceImage));
      setSources((prev) => [...prev, ...loaded]);
      clearResults(setResults);
    } catch {
      setError("Could not read one or more images. Try a different file.");
    }
  }, []);

  const removeSource = useCallback((id: string) => {
    setSources((prev) => {
      const next = prev.filter((s) => s.id !== id);
      const removed = prev.find((s) => s.id === id);
      if (removed) revokeSource(removed);
      return next;
    });
    setResults((prev) => {
      const keep = prev.filter((r) => r.sourceId !== id);
      revokeResults(prev.filter((r) => r.sourceId === id));
      return keep;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSources((prev) => {
      prev.forEach(revokeSource);
      return [];
    });
    clearResults(setResults);
    setProgress({ done: 0, total: 0 });
    setError(null);
  }, []);

  const togglePlatform = useCallback((id: PlatformId) => {
    setPlatforms((prev) =>
      prev.includes(id)
        ? prev.length === 1
          ? prev
          : prev.filter((p) => p !== id)
        : [...prev, id],
    );
    clearResults(setResults);
  }, []);

  const runGenerate = useCallback(async () => {
    if (sources.length === 0 || selectedSizes.length === 0) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: jobCount });
    try {
      clearResults(setResults);
      const generated = await generateAll({
        sources,
        sizes: selectedSizes,
        mode,
        background,
        frames,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResults(generated);
    } catch {
      setError("Resize failed. Try fewer images or smaller sources.");
    } finally {
      setBusy(false);
    }
  }, [sources, selectedSizes, mode, background, frames, jobCount]);

  const bump = (fn: () => void) => {
    fn();
    clearResults(setResults);
  };

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
  const bgPreview = cssBackgroundPreview(background);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <ResizerPanelTop
        sources={sources}
        platforms={platforms}
        background={background}
        frames={frames}
        dragOver={dragOver}
        inputRef={inputRef}
        selectedSizesLen={selectedSizes.length}
        jobCount={jobCount}
        bgPreview={bgPreview}
        addFiles={addFiles}
        removeSource={removeSource}
        togglePlatform={togglePlatform}
        bump={bump}
        setBgKind={(kind: BackgroundKind) => {
          bump(() => {
            if (kind === "solid") {
              setBackground({
                kind: "solid",
                color:
                  background.kind === "solid" ? background.color : "#000000",
              });
            } else {
              setBackground({
                kind: "gradient",
                from:
                  background.kind === "gradient"
                    ? background.from
                    : "#0b1020",
                to:
                  background.kind === "gradient"
                    ? background.to
                    : "#1d1d1f",
                direction:
                  background.kind === "gradient"
                    ? background.direction
                    : "vertical",
              });
            }
          });
        }}
        setBackground={setBackground}
        setDragOver={setDragOver}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
      />
      <ResizerPanelBottom
        sourcesLen={sources.length}
        mode={mode}
        frames={frames}
        results={results}
        busy={busy}
        error={error}
        pct={pct}
        platformsLen={platforms.length}
        grouped={grouped}
        bump={bump}
        setFrames={setFrames}
        setMode={setMode}
        runGenerate={runGenerate}
        clearAll={clearAll}
      />
    </div>
  );
}
