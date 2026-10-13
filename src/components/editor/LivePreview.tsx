"use client";

import { useEffect, useRef, useState } from "react";
import {
  composeToCanvas,
  type SourceImage,
} from "@/lib/resize";
import type { DesignState } from "@/lib/design";
import type { ScreenshotSize } from "@/lib/sizes";
import { formatSize } from "@/lib/sizes";

interface LivePreviewProps {
  source: SourceImage | null;
  secondary: SourceImage | null;
  size: ScreenshotSize | null;
  design: DesignState;
}

export default function LivePreview({
  source,
  secondary,
  size,
  design,
}: LivePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (!source || !size || !canvasRef.current) return;
    let cancelled = false;
    const run = async () => {
      setRendering(true);
      setError(null);
      try {
        const composed = await composeToCanvas(
          source.bitmap,
          size,
          {
            mode: design.mode,
            design,
            secondary: secondary?.bitmap ?? null,
            guides: true,
          },
          true,
        );
        if (cancelled) return;
        const target = canvasRef.current;
        if (!target) return;
        target.width = composed.width;
        target.height = composed.height;
        const ctx = target.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, target.width, target.height);
        ctx.drawImage(composed, 0, 0);
      } catch {
        if (!cancelled) setError("Preview failed to render.");
      } finally {
        if (!cancelled) setRendering(false);
      }
    };
    const handle = window.setTimeout(() => void run(), 80);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [source, secondary, size, design]);

  if (!source || !size) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 rounded-[1.5rem] border border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-6 text-center">
        <p className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
          Live canvas
        </p>
        <p className="max-w-sm text-sm text-[var(--muted)]">
          Upload a screenshot to see the framed composition update as you design.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.14em] text-[var(--muted)] uppercase">
            Live preview
          </p>
          <p className="mt-1 text-sm text-[var(--ink)]">
            {size.displayName} · {formatSize(size)}
          </p>
        </div>
        {rendering && (
          <span className="text-xs text-[var(--accent)]">Updating…</span>
        )}
      </div>
      <div className="relative flex min-h-[360px] flex-1 items-center justify-center overflow-hidden rounded-[1.5rem] bg-[linear-gradient(160deg,#0c1618_0%,#152428_45%,#0a1214_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #5eead4 0, transparent 40%), radial-gradient(circle at 80% 70%, #99f6e4 0, transparent 35%)",
          }}
        />
        <canvas
          ref={canvasRef}
          className="relative z-[1] max-h-[min(70vh,720px)] max-w-full object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.45)] transition-opacity duration-300"
          style={{ opacity: rendering ? 0.7 : 1 }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-[#b91c1c]">
          {error}
        </p>
      )}
    </div>
  );
}
