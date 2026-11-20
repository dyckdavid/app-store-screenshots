"use client";

import { useRef, useState } from "react";
import type { ShotCopy } from "@/lib/studio/model";

export interface ShotView {
  id: string;
  name: string;
  thumb: string;
  copy: ShotCopy;
  example: boolean;
}

const field =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--accent)]";

export default function ShotPanel({
  shots,
  selectedId,
  aiEnabled,
  aiBusyId,
  onAdd,
  onSelect,
  onCopy,
  onMove,
  onReorder,
  onRemove,
  onAiCaption,
}: {
  shots: ShotView[];
  selectedId: string | null;
  aiEnabled: boolean;
  aiBusyId: string | null;
  onAdd: (files: File[]) => void;
  onSelect: (id: string) => void;
  onCopy: (id: string, patch: Partial<ShotCopy>) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onReorder: (fromId: string, toId: string) => void;
  onRemove: (id: string) => void;
  onAiCaption: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <section
      className={`flex flex-col gap-3 rounded-[1.25rem] border bg-[var(--surface)] p-4 ${
        over ? "border-[var(--accent)]" : "border-[var(--line)]"
      }`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setOver(false);
        onAdd(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Screenshots {shots.length ? `· ${shots.length}` : ""}
        </h2>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
        >
          + Add
        </button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onAdd(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>

      {shots.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--line)] bg-white/60 p-6 text-center"
        >
          <span className="text-[15px] font-medium text-[var(--ink)]">Drop your app screenshots</span>
          <span className="text-sm text-[var(--muted)]">
            Raw simulator or device captures (PNG/JPEG). Portrait or landscape — we match the device.
          </span>
        </button>
      ) : (
        <ol className="flex flex-col gap-2">
          {shots.map((shot, i) => {
            const active = shot.id === selectedId;
            return (
              <li
                key={shot.id}
                draggable
                onDragStart={() => setDragId(shot.id)}
                onDragOver={(e) => dragId && e.preventDefault()}
                onDrop={(e) => {
                  if (dragId) {
                    e.preventDefault();
                    e.stopPropagation();
                    onReorder(dragId, shot.id);
                    setDragId(null);
                  }
                }}
                onClick={() => onSelect(shot.id)}
                className={`flex gap-3 rounded-xl border p-2.5 transition-colors ${
                  active ? "border-[var(--accent)] bg-white" : "border-transparent bg-[var(--surface-muted)]/60"
                }`}
              >
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-[var(--muted)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.thumb}
                    alt={shot.name}
                    className="h-[72px] w-auto max-w-[56px] rounded-md border border-[var(--line)] object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <textarea
                    rows={2}
                    value={shot.copy.headline}
                    placeholder="Headline — the benefit, in 3–6 words"
                    onChange={(e) => onCopy(shot.id, { headline: e.target.value })}
                    onFocus={() => onSelect(shot.id)}
                    className={`${field} resize-none font-medium ${shot.example ? "italic text-[var(--muted)]" : ""}`}
                  />
                  <input
                    value={shot.copy.subtitle}
                    placeholder="Subtitle (optional)"
                    onChange={(e) => onCopy(shot.id, { subtitle: e.target.value })}
                    onFocus={() => onSelect(shot.id)}
                    className={field}
                  />
                  <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => onMove(shot.id, -1)} className="rounded px-1.5 py-0.5 hover:bg-[var(--surface-muted)] disabled:opacity-30">↑</button>
                    <button type="button" aria-label="Move down" disabled={i === shots.length - 1} onClick={() => onMove(shot.id, 1)} className="rounded px-1.5 py-0.5 hover:bg-[var(--surface-muted)] disabled:opacity-30">↓</button>
                    {aiEnabled ? (
                      <button
                        type="button"
                        disabled={aiBusyId !== null}
                        onClick={() => onAiCaption(shot.id)}
                        className="rounded px-1.5 py-0.5 text-[var(--accent)] hover:bg-[var(--surface-muted)] disabled:opacity-40"
                      >
                        {aiBusyId === shot.id ? "Writing…" : "✨ Write with AI"}
                      </button>
                    ) : null}
                    <span className="flex-1" />
                    <button type="button" onClick={() => onRemove(shot.id)} className="rounded px-1.5 py-0.5 hover:bg-[#fff2f2] hover:text-[#b91010]">
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {shots.some((s) => s.example) ? (
        <p className="text-xs text-[var(--muted)]">
          <span className="italic">Italic</span> captions are examples — replace them with your app&apos;s real benefits.
        </p>
      ) : null}
    </section>
  );
}
