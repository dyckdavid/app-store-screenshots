"use client";

import { SCREENSHOT_SIZES } from "@/lib/sizes";
import { SIZE_GROUPS, sizeLabel } from "@/lib/studio/project";

export default function ExportPanel({
  sizeIds,
  onSizes,
  shotCount,
  exporting,
  watermark,
  onExport,
  onRemoveWatermark,
}: {
  sizeIds: string[];
  onSizes: (ids: string[]) => void;
  shotCount: number;
  exporting: { done: number; total: number } | null;
  watermark: boolean;
  onExport: () => void;
  onRemoveWatermark: () => void;
}) {
  const selected = new Set(sizeIds);
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSizes(SCREENSHOT_SIZES.filter((s) => next.has(s.id)).map((s) => s.id));
  };
  const total = shotCount * sizeIds.length;
  const pct = exporting ? Math.round((exporting.done / Math.max(1, exporting.total)) * 100) : 0;

  return (
    <section className="space-y-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Export sizes</p>
      <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
        {SIZE_GROUPS.map((g) => {
          const sizes = SCREENSHOT_SIZES.filter((s) => s.platform === g.platform);
          const count = sizes.filter((s) => selected.has(s.id)).length;
          return (
            <details key={g.platform} open={g.platform === "iphone" || count > 0}>
              <summary className="cursor-pointer text-sm font-medium text-[var(--ink)]">
                {g.label} {count ? <span className="text-[var(--accent)]">· {count}</span> : null}
              </summary>
              <p className="mt-1 text-xs text-[var(--muted)]">{g.hint}</p>
              <div className="mt-1.5 space-y-1">
                {sizes.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-[13px] text-[var(--ink-soft)]">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                    {sizeLabel(s)}
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      {watermark ? (
        <div className="rounded-xl bg-[var(--accent)]/8 px-3 py-2.5 text-[13px] text-[var(--ink-soft)]">
          Free exports carry a small “Made with ASC Studio” badge.{" "}
          <button type="button" onClick={onRemoveWatermark} className="font-medium text-[var(--accent)] underline">
            Remove watermark — go Pro
          </button>
        </div>
      ) : null}

      <button
        type="button"
        disabled={!shotCount || !sizeIds.length || exporting !== null}
        onClick={onExport}
        className="relative min-h-[50px] w-full overflow-hidden rounded-full bg-[var(--ink)] text-[15px] font-medium text-white disabled:opacity-40"
      >
        {exporting ? (
          <>
            <span className="absolute inset-y-0 left-0 bg-[var(--accent)] transition-[width]" style={{ width: `${pct}%` }} />
            <span className="relative">Rendering {exporting.done}/{exporting.total}…</span>
          </>
        ) : total ? (
          `Download ZIP · ${total} PNG${total === 1 ? "" : "s"}`
        ) : (
          "Download ZIP"
        )}
      </button>
      <p className="text-center text-xs text-[var(--muted)]">Exact App Store Connect pixel sizes · opaque RGB PNG</p>
    </section>
  );
}
