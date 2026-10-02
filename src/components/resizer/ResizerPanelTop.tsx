"use client";

import {
  SOLID_PRESETS,
  GRADIENT_PRESETS,
  GRADIENT_DIRECTIONS,
  type Background,
  type BackgroundKind,
} from "@/lib/background";
import { PLATFORMS, type PlatformId } from "@/lib/sizes";
import type { SourceImage } from "@/lib/resize";
import type { RefObject } from "react";

export interface ResizerPanelTopProps {
  sources: SourceImage[];
  platforms: PlatformId[];
  background: Background;
  frames: boolean;
  dragOver: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  selectedSizesLen: number;
  jobCount: number;
  bgPreview: string;
  addFiles: (files: FileList | File[]) => void;
  removeSource: (id: string) => void;
  togglePlatform: (id: PlatformId) => void;
  bump: (fn: () => void) => void;
  setBgKind: (kind: BackgroundKind) => void;
  setBackground: (bg: Background) => void;
  setDragOver: (v: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
}

export default function ResizerPanelTop({
  sources,
  platforms,
  background,
  frames,
  dragOver,
  inputRef,
  selectedSizesLen,
  jobCount,
  bgPreview,
  addFiles,
  removeSource,
  togglePlatform,
  bump,
  setBgKind,
  setBackground,
  setDragOver,
  onDrop,
}: ResizerPanelTopProps) {
  return (
    <>
      <header className="space-y-3">
        <p className="text-[13px] font-medium tracking-wide text-[#86868b] uppercase">
          App Store Connect
        </p>
        <h1 className="text-[34px] leading-tight font-semibold tracking-tight text-[#1d1d1f] sm:text-[40px]">
          Screenshot Resizer
        </h1>
        <p className="max-w-xl text-[17px] leading-relaxed text-[#6e6e73]">
          Upload screenshots, pick a background, optionally wrap in a device
          frame, and export every App Store Connect pixel size — in your
          browser.
        </p>
      </header>

      <section aria-labelledby="upload-heading" className="space-y-4">
        <h2 id="upload-heading" className="sr-only">
          Upload screenshots
        </h2>
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
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragOver
              ? "border-[#0071e3] bg-[#f5f9ff]"
              : "border-[#d2d2d7] bg-[#fafafa] hover:border-[#86868b]"
          }`}
        >
          <span className="text-[17px] font-medium text-[#1d1d1f]">
            Drop screenshots here
          </span>
          <span className="text-[15px] text-[#6e6e73]">
            or tap to choose PNG, JPEG, or WebP
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {sources.length === 0 && (
          <p className="text-center text-[15px] text-[#86868b]">
            No images yet — add at least one screenshot to get started.
          </p>
        )}
        {sources.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {sources.map((source) => (
              <li
                key={source.id}
                className="relative w-[88px] overflow-hidden rounded-xl bg-[#f5f5f7]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={source.previewUrl}
                  alt={source.name}
                  className="aspect-[9/16] w-full object-cover"
                />
                <button
                  type="button"
                  aria-label={`Remove ${source.name}`}
                  onClick={() => removeSource(source.id)}
                  className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white"
                >
                  ×
                </button>
                <p className="truncate px-1.5 py-1 text-[10px] text-[#6e6e73]">
                  {source.name}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="platforms-heading" className="space-y-4">
        <div>
          <h2
            id="platforms-heading"
            className="text-[21px] font-semibold text-[#1d1d1f]"
          >
            Platforms
          </h2>
          <p className="mt-1 text-[15px] text-[#6e6e73]">
            Choose which App Store Connect size sets to generate.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PLATFORMS.map((platform) => {
            const on = platforms.includes(platform.id);
            return (
              <button
                key={platform.id}
                type="button"
                aria-pressed={on}
                onClick={() => togglePlatform(platform.id)}
                className={`min-h-[52px] rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                  on
                    ? "bg-[#1d1d1f] text-white"
                    : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
                }`}
              >
                {platform.label}
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-[#86868b]">
          {selectedSizesLen} sizes selected
          {sources.length > 0
            ? ` · ${jobCount} output${jobCount === 1 ? "" : "s"}`
            : ""}
        </p>
      </section>

      <section aria-labelledby="bg-heading" className="space-y-4">
        <div>
          <h2
            id="bg-heading"
            className="text-[21px] font-semibold text-[#1d1d1f]"
          >
            Background
          </h2>
          <p className="mt-1 text-[15px] text-[#6e6e73]">
            Fills the canvas behind the screenshot
            {frames ? " and around the device frame" : ""}.
          </p>
        </div>
        <div
          role="group"
          aria-label="Background type"
          className="inline-flex rounded-xl bg-[#f5f5f7] p-1"
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
              aria-pressed={background.kind === kind.id}
              onClick={() => setBgKind(kind.id)}
              className={`min-h-[44px] rounded-lg px-5 text-[15px] font-medium transition-colors ${
                background.kind === kind.id
                  ? "bg-white text-[#1d1d1f] shadow-sm"
                  : "text-[#6e6e73]"
              }`}
            >
              {kind.label}
            </button>
          ))}
        </div>
        <div
          className="h-14 w-full rounded-2xl border border-[#d2d2d7]"
          style={{ background: bgPreview }}
          aria-hidden
        />
        {background.kind === "solid" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {SOLID_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  type="button"
                  title={preset.label}
                  aria-label={preset.label}
                  aria-pressed={background.color === preset.color}
                  onClick={() =>
                    bump(() =>
                      setBackground({ kind: "solid", color: preset.color }),
                    )
                  }
                  className={`h-10 w-10 rounded-full border-2 ${
                    background.color === preset.color
                      ? "border-[#0071e3]"
                      : "border-[#d2d2d7]"
                  }`}
                  style={{ backgroundColor: preset.color }}
                />
              ))}
            </div>
            <label className="flex items-center gap-3 text-[15px] text-[#1d1d1f]">
              <span className="w-16 text-[#6e6e73]">Custom</span>
              <input
                type="color"
                value={background.color}
                onChange={(e) =>
                  bump(() =>
                    setBackground({
                      kind: "solid",
                      color: e.target.value,
                    }),
                  )
                }
                className="h-10 w-14 cursor-pointer rounded-lg border border-[#d2d2d7] bg-white p-1"
              />
              <span className="font-mono text-[13px] text-[#86868b]">
                {background.color}
              </span>
            </label>
          </div>
        )}
        {background.kind === "gradient" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {GRADIENT_PRESETS.map((preset) => {
                const active =
                  background.from === preset.from &&
                  background.to === preset.to &&
                  background.direction === preset.direction;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    title={preset.label}
                    aria-pressed={active}
                    onClick={() =>
                      bump(() =>
                        setBackground({
                          kind: "gradient",
                          from: preset.from,
                          to: preset.to,
                          direction: preset.direction,
                        }),
                      )
                    }
                    className={`h-10 min-w-[72px] rounded-xl border-2 px-2 text-[11px] font-medium text-white ${
                      active ? "border-[#0071e3]" : "border-[#d2d2d7]"
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-[15px]">
                <span className="text-[#6e6e73]">From</span>
                <input
                  type="color"
                  value={background.from}
                  onChange={(e) =>
                    bump(() =>
                      setBackground({
                        ...background,
                        from: e.target.value,
                      }),
                    )
                  }
                  className="h-10 w-14 cursor-pointer rounded-lg border border-[#d2d2d7] bg-white p-1"
                />
              </label>
              <label className="flex items-center gap-2 text-[15px]">
                <span className="text-[#6e6e73]">To</span>
                <input
                  type="color"
                  value={background.to}
                  onChange={(e) =>
                    bump(() =>
                      setBackground({
                        ...background,
                        to: e.target.value,
                      }),
                    )
                  }
                  className="h-10 w-14 cursor-pointer rounded-lg border border-[#d2d2d7] bg-white p-1"
                />
              </label>
            </div>
            <div
              role="group"
              aria-label="Gradient direction"
              className="flex flex-wrap gap-2"
            >
              {GRADIENT_DIRECTIONS.map((dir) => (
                <button
                  key={dir.id}
                  type="button"
                  aria-pressed={background.direction === dir.id}
                  onClick={() =>
                    bump(() =>
                      setBackground({
                        ...background,
                        direction: dir.id,
                      }),
                    )
                  }
                  className={`min-h-[40px] rounded-full px-4 text-[13px] font-medium ${
                    background.direction === dir.id
                      ? "bg-[#1d1d1f] text-white"
                      : "bg-[#f5f5f7] text-[#1d1d1f]"
                  }`}
                >
                  {dir.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
