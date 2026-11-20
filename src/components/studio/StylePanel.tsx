"use client";

import { FONT_OPTIONS } from "@/lib/fonts";
import {
  AUTO_THEME_ID,
  CUSTOM_THEME_ID,
  LAYOUTS,
  THEMES,
  customTheme,
  type Background,
  type LayoutId,
  type StudioStyle,
  type Theme,
} from "@/lib/studio/model";

export function cssBackground(bg: Background): string {
  if (bg.kind === "solid") return bg.color;
  if (bg.kind === "linear") return `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`;
  if (bg.kind === "mesh") {
    const blobs = bg.blobs
      .map((b) => `radial-gradient(circle at ${b.x * 100}% ${b.y * 100}%, ${b.color}, transparent ${Math.round(b.r * 70)}%)`)
      .join(", ");
    return `${blobs}, ${bg.base}`;
  }
  return "#000";
}

/** Tiny wireframe so layouts are recognizable at a glance. */
function LayoutIcon({ id }: { id: LayoutId }) {
  const phone = (x: number, y: number, h: number, rot = 0, o = 1) => (
    <rect x={x} y={y} width={h * 0.48} height={h} rx={3} transform={rot ? `rotate(${rot} ${x + h * 0.24} ${y + h / 2})` : undefined} fill="currentColor" opacity={o} />
  );
  const bars = (y: number) => (
    <>
      <rect x={9} y={y} width={22} height={3} rx={1.5} fill="currentColor" />
      <rect x={13} y={y + 5} width={14} height={2} rx={1} fill="currentColor" opacity={0.5} />
    </>
  );
  return (
    <svg viewBox="0 0 40 60" className="h-12 w-8" aria-hidden>
      {id === "hero" && (<>{bars(6)}{phone(9, 20, 46)}</>)}
      {id === "classic" && (<>{bars(6)}{phone(12, 20, 34)}</>)}
      {id === "caption-bottom" && (<>{phone(9, -6, 46)}{bars(48)}</>)}
      {id === "tilt" && (<>{bars(6)}{phone(12, 21, 33, -8)}</>)}
      {id === "duo" && (<>{bars(6)}{phone(5, 24, 34, -5, 0.5)}{phone(17, 20, 40, 3)}</>)}
      {id === "frameless" && (<>{bars(6)}<rect x={11} y={20} width={18} height={34} rx={4} fill="none" stroke="currentColor" strokeWidth={2} /></>)}
    </svg>
  );
}

const label = "text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]";

export default function StylePanel({
  style,
  autoTheme,
  onChange,
}: {
  style: StudioStyle;
  autoTheme: Theme | null;
  onChange: (next: StudioStyle) => void;
}) {
  const set = (patch: Partial<StudioStyle>) => onChange({ ...style, ...patch });
  const setCaption = (patch: Partial<StudioStyle["caption"]>) =>
    onChange({ ...style, caption: { ...style.caption, ...patch } });

  const swatches: { id: string; label: string; bg: string }[] = [
    ...(autoTheme ? [{ id: AUTO_THEME_ID, label: "From your app", bg: cssBackground(autoTheme.background) }] : []),
    ...THEMES.map((t) => ({ id: t.id, label: t.label, bg: cssBackground(t.background) })),
    { id: CUSTOM_THEME_ID, label: "Custom", bg: cssBackground(customTheme(style.custom.from, style.custom.to).background) },
  ];

  return (
    <section className="space-y-5 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div>
        <p className={label}>Layout</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              title={l.hint}
              onClick={() => set({ layout: l.id })}
              className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] ${
                style.layout === l.id
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--line)] bg-white text-[var(--ink-soft)]"
              }`}
            >
              <LayoutIcon id={l.id} />
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={label}>Background</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {swatches.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.label}
              aria-label={s.label}
              onClick={() => set({ themeId: s.id })}
              className={`h-9 w-9 rounded-full border-2 ${
                style.themeId === s.id ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30" : "border-white"
              } shadow-sm`}
              style={{ background: s.bg }}
            >
              {s.id === AUTO_THEME_ID ? <span className="text-xs text-white drop-shadow">★</span> : null}
              {s.id === CUSTOM_THEME_ID ? <span className="text-xs text-white drop-shadow">+</span> : null}
            </button>
          ))}
        </div>
        {style.themeId === CUSTOM_THEME_ID ? (
          <div className="mt-2 flex items-center gap-3 text-sm text-[var(--ink-soft)]">
            <label className="flex items-center gap-1.5">
              Top
              <input type="color" value={style.custom.from} onChange={(e) => set({ custom: { ...style.custom, from: e.target.value } })} />
            </label>
            <label className="flex items-center gap-1.5">
              Bottom
              <input type="color" value={style.custom.to} onChange={(e) => set({ custom: { ...style.custom, to: e.target.value } })} />
            </label>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className={label}>Caption</p>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={style.caption.fontId}
            onChange={(e) => setCaption({ fontId: e.target.value })}
            className="min-h-[38px] rounded-lg border border-[var(--line)] bg-white px-2 text-sm"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <select
            value={style.caption.weight}
            onChange={(e) => setCaption({ weight: Number(e.target.value) as 600 | 700 | 800 })}
            className="min-h-[38px] rounded-lg border border-[var(--line)] bg-white px-2 text-sm"
          >
            <option value={600}>Semibold</option>
            <option value={700}>Bold</option>
            <option value={800}>Heavy</option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {(["center", "left"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setCaption({ align: a })}
              className={`rounded-lg border px-3 py-1.5 ${style.caption.align === a ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--line)] bg-white"}`}
            >
              {a === "center" ? "Centered" : "Left"}
            </button>
          ))}
          <span className="flex-1" />
          <label className="flex items-center gap-1.5 text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={style.caption.color !== null}
              onChange={(e) => setCaption({ color: e.target.checked ? "#ffffff" : null })}
            />
            Color
          </label>
          {style.caption.color !== null ? (
            <input type="color" value={style.caption.color} onChange={(e) => setCaption({ color: e.target.value })} />
          ) : null}
        </div>
        <label className="block text-sm text-[var(--ink-soft)]">
          Text size · {Math.round(style.caption.scale * 100)}%
          <input type="range" min={0.8} max={1.3} step={0.05} value={style.caption.scale} onChange={(e) => setCaption({ scale: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
        </label>
      </div>

      <div className="space-y-2">
        <p className={label}>Device</p>
        <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <input type="checkbox" checked={style.frames} onChange={(e) => set({ frames: e.target.checked })} />
          Show device frame
        </label>
        <label className="block text-sm text-[var(--ink-soft)]">
          Device size · {Math.round(style.deviceScale * 100)}%
          <input type="range" min={0.8} max={1.15} step={0.05} value={style.deviceScale} onChange={(e) => set({ deviceScale: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
        </label>
      </div>
    </section>
  );
}
