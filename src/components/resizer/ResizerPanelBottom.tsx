"use client";

import { downloadBlob, downloadZip } from "@/lib/download";
import { formatSize } from "@/lib/sizes";
import type { FitMode, GeneratedResult } from "@/lib/resize";
import type { PlatformId } from "@/lib/sizes";

export interface GroupedResults {
  id: PlatformId;
  label: string;
  items: GeneratedResult[];
}

export interface ResizerPanelBottomProps {
  sourcesLen: number;
  mode: FitMode;
  frames: boolean;
  results: GeneratedResult[];
  busy: boolean;
  error: string | null;
  pct: number;
  platformsLen: number;
  grouped: GroupedResults[];
  bump: (fn: () => void) => void;
  setFrames: React.Dispatch<React.SetStateAction<boolean>>;
  setMode: React.Dispatch<React.SetStateAction<FitMode>>;
  runGenerate: () => void | Promise<void>;
  clearAll: () => void;
}

export default function ResizerPanelBottom({
  sourcesLen,
  mode,
  frames,
  results,
  busy,
  error,
  pct,
  platformsLen,
  grouped,
  bump,
  setFrames,
  setMode,
  runGenerate,
  clearAll,
}: ResizerPanelBottomProps) {
  return (
    <>
      <section aria-labelledby="frames-heading" className="space-y-4">
        <div>
          <h2
            id="frames-heading"
            className="text-[21px] font-semibold text-[#1d1d1f]"
          >
            Device frames
          </h2>
          <p className="mt-1 text-[15px] text-[#6e6e73]">
            Real PNG bezels for iPhone, iPad, and MacBook (screen-masked).
            Apple Watch uses a lightweight drawn bezel. Output stays exact ASC
            pixel size.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={frames}
          onClick={() =>
            bump(() => {
              setFrames((v) => !v);
            })
          }
          className={`flex min-h-[52px] w-full items-center justify-between rounded-2xl px-5 text-[15px] font-medium transition-colors sm:w-auto sm:min-w-[280px] sm:gap-10 ${
            frames
              ? "bg-[#1d1d1f] text-white"
              : "bg-[#f5f5f7] text-[#1d1d1f]"
          }`}
        >
          <span>{frames ? "Frames on" : "Frames off"}</span>
          <span
            className={`relative h-7 w-12 rounded-full transition-colors ${
              frames ? "bg-[#0071e3]" : "bg-[#d2d2d7]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                frames ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
      </section>

      <section aria-labelledby="mode-heading" className="space-y-4">
        <div>
          <h2
            id="mode-heading"
            className="text-[21px] font-semibold text-[#1d1d1f]"
          >
            Resize mode
          </h2>
          <p className="mt-1 text-[15px] text-[#6e6e73]">
            {frames
              ? "Device frames cover-fill the screen, composite onto your background, then resize to Apple’s exact pixel sizes. Mode below applies when frames are off (and to Watch)."
              : "How the screenshot fills the canvas. Outputs always match Apple’s exact pixel sizes."}
          </p>
        </div>
        <div
          role="group"
          aria-label="Resize mode"
          className={`inline-flex rounded-xl bg-[#f5f5f7] p-1 ${
            frames ? "opacity-70" : ""
          }`}
        >
          {(
            [
              {
                id: "contain" as const,
                label: "Contain",
                hint: "Fit inside, letterbox",
              },
              {
                id: "cover" as const,
                label: "Cover",
                hint: "Fill & crop center",
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              onClick={() =>
                bump(() => {
                  setMode(item.id);
                })
              }
              className={`min-h-[48px] rounded-lg px-5 py-2 text-left transition-colors ${
                mode === item.id
                  ? "bg-white text-[#1d1d1f] shadow-sm"
                  : "text-[#6e6e73]"
              }`}
            >
              <span className="block text-[15px] font-medium">{item.label}</span>
              <span className="block text-[12px] opacity-80">{item.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={busy || sourcesLen === 0 || platformsLen === 0}
          onClick={() => void runGenerate()}
          className="min-h-[52px] rounded-full bg-[#0071e3] px-8 text-[17px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? `Generating… ${pct}%` : "Generate sizes"}
        </button>
        <button
          type="button"
          disabled={busy || results.length === 0}
          onClick={() => void downloadZip(results)}
          className="min-h-[52px] rounded-full bg-[#1d1d1f] px-8 text-[17px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Download ZIP
        </button>
        {sourcesLen > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={clearAll}
            className="min-h-[52px] rounded-full px-6 text-[17px] font-medium text-[#0071e3] disabled:opacity-40"
          >
            Clear all
          </button>
        )}
      </section>

      {busy && (
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 overflow-hidden rounded-full bg-[#e8e8ed]"
        >
          <div
            className="h-full rounded-full bg-[#0071e3] transition-[width] duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-[#fff2f2] px-4 py-3 text-[15px] text-[#b91010]"
        >
          {error}
        </p>
      )}

      {results.length > 0 && (
        <section aria-labelledby="results-heading" className="space-y-8">
          <div>
            <h2
              id="results-heading"
              className="text-[21px] font-semibold text-[#1d1d1f]"
            >
              Results
            </h2>
            <p className="mt-1 text-[15px] text-[#6e6e73]">
              {results.length} PNG{results.length === 1 ? "" : "s"} ready — each
              is the exact ASC pixel size.
            </p>
          </div>
          {grouped.map((group) => (
            <div key={group.id} className="space-y-4">
              <h3 className="text-[17px] font-semibold text-[#1d1d1f]">
                {group.label}
              </h3>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-2xl bg-[#f5f5f7]"
                  >
                    <div className="flex aspect-[3/4] items-center justify-center bg-[#1d1d1f]/[8%]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.previewUrl}
                        alt={`${item.size.displayName} ${formatSize(item.size)}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <p className="text-[13px] leading-snug font-medium text-[#1d1d1f]">
                        {item.size.displayName}
                      </p>
                      <p className="text-[12px] text-[#6e6e73]">
                        {formatSize(item.size)}
                        {item.size.platform !== "mac" &&
                        item.size.platform !== "watch"
                          ? ` · ${item.size.orientation}`
                          : ""}
                      </p>
                      <p className="truncate text-[11px] text-[#86868b]">
                        {item.sourceName}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          downloadBlob(item.blob, item.filename)
                        }
                        className="mt-auto min-h-[40px] rounded-full bg-white text-[13px] font-medium text-[#0071e3]"
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

      <aside className="rounded-2xl border border-[#d2d2d7] px-5 py-4 text-[14px] text-[#86868b]">
        <span className="font-medium text-[#6e6e73]">Coming soon</span> — text
        overlays and marketing graphics editing.
      </aside>

      <footer className="border-t border-[#d2d2d7] pt-6 text-[12px] text-[#86868b]">
        Sizes from{" "}
        <a
          href="https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/"
          className="text-[#0071e3] underline-offset-2 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple’s App Store Connect screenshot specifications
        </a>
        . Processing stays on your device — nothing is uploaded to a server.
      </footer>
    </>
  );
}
