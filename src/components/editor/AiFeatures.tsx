"use client";

import { useCallback, useEffect, useState } from "react";
import {
  analyzeScreenshot,
  downscaleImageForVision,
  fetchAiStatus,
  generateAiImage,
} from "@/lib/ai/client";
import type {
  AiStatusResponse,
  ScreenshotAiSuggestions,
} from "@/lib/ai/types";
import type { DesignState } from "@/lib/design";
import type { PlatformId } from "@/lib/sizes";
import type { SourceImage } from "@/lib/resize";
import { createGraphicLayer, type GraphicLayer } from "@/lib/graphics";

interface AiFeaturesProps {
  source: SourceImage | null;
  design: DesignState;
  onPatchDesign: (partial: Partial<DesignState>) => void;
  onPatchText: (partial: Partial<DesignState["text"]>) => void;
  platforms: PlatformId[];
  onSetPlatforms: (platforms: PlatformId[]) => void;
  analyzeToken: number;
}

export default function AiFeatures({
  source,
  design,
  onPatchDesign,
  onPatchText,
  platforms,
  onSetPlatforms,
  analyzeToken,
}: AiFeaturesProps) {
  const [status, setStatus] = useState<AiStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(
    "Soft teal mist with subtle geometric light rays",
  );
  const [purpose, setPurpose] = useState<"background" | "graphic">(
    "background",
  );
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [suggestions, setSuggestions] =
    useState<ScreenshotAiSuggestions | null>(null);
  const [lastAnalyzedKey, setLastAnalyzedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchAiStatus()
      .then((s) => {
        if (!cancelled) {
          setStatus(s);
          setStatusError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatusError("Could not reach AI status endpoint.");
          setStatus({
            enabled: false,
            models: {
              image: {
                id: "grok-imagine-image",
                priceUsdPerImage: 0.02,
                source: "",
              },
              vision: {
                id: "grok-build-0.1",
                inputUsdPerMillionTokens: 1,
                outputUsdPerMillionTokens: 2,
                source: "",
              },
            },
            caps: {
              perIpPerMinute: 5,
              perIpPerDay: 30,
              globalPerDay: 200,
              maxPromptLength: 500,
              visionMaxEdge: 768,
            },
            note: "AI features are disabled — set XAI_API_KEY on the server to enable.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runAnalyze = useCallback(async () => {
    if (!source || !status?.enabled) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const maxEdge = status.caps.visionMaxEdge;
      const imageDataUrl = await downscaleImageForVision(
        source.bitmap,
        maxEdge,
      );
      const { suggestions: next } = await analyzeScreenshot({ imageDataUrl });
      setSuggestions(next);
      setLastAnalyzedKey(source.id);
    } catch (err) {
      setAnalyzeError(
        err instanceof Error ? err.message : "Analysis failed.",
      );
    } finally {
      setAnalyzing(false);
    }
  }, [source, status]);

  useEffect(() => {
    if (!status?.enabled || !source || analyzeToken <= 0) return;
    if (lastAnalyzedKey === source.id && suggestions) return;
    const handle = window.setTimeout(() => {
      void runAnalyze();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [
    analyzeToken,
    source,
    status?.enabled,
    lastAnalyzedKey,
    suggestions,
    runAnalyze,
  ]);

  const onGenerate = useCallback(async () => {
    if (!status?.enabled) return;
    setGenerating(true);
    setGenError(null);
    try {
      const { dataUrl } = await generateAiImage({ prompt, purpose });
      if (purpose === "background") {
        onPatchDesign({
          background: {
            kind: "image",
            imageDataUrl: dataUrl,
            fallbackColor:
              design.background.kind === "solid"
                ? design.background.color
                : design.background.kind === "gradient"
                  ? design.background.to
                  : design.background.fallbackColor,
          },
        });
      } else {
        const layer = createGraphicLayer(dataUrl);
        onPatchDesign({
          graphics: [...(design.graphics ?? []), layer],
        });
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [status?.enabled, prompt, purpose, design, onPatchDesign]);

  const applyAll = useCallback(() => {
    if (!suggestions) return;
    applyCaptions(suggestions, onPatchText);
    applyLayout(suggestions, onPatchDesign);
    applyDevice(suggestions, platforms, onSetPlatforms);
    applyBackground(suggestions, onPatchDesign);
    applyPalette(suggestions, onPatchText, onPatchDesign);
  }, [
    suggestions,
    onPatchText,
    onPatchDesign,
    platforms,
    onSetPlatforms,
  ]);

  const updateLayer = useCallback(
    (id: string, partial: Partial<GraphicLayer>) => {
      onPatchDesign({
        graphics: (design.graphics ?? []).map((g) =>
          g.id === id ? { ...g, ...partial } : g,
        ),
      });
    },
    [design.graphics, onPatchDesign],
  );

  const removeLayer = useCallback(
    (id: string) => {
      onPatchDesign({
        graphics: (design.graphics ?? []).filter((g) => g.id !== id),
      });
    },
    [design.graphics, onPatchDesign],
  );

  const enabled = Boolean(status?.enabled);
  const maxPrompt = status?.caps.maxPromptLength ?? 500;

  return (
    <section className="space-y-4 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
          AI (xAI Grok)
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Generate backgrounds / decorative graphics and get one-click styling
          suggestions from your screenshot. Calls run server-side only.
        </p>
      </div>

      {!enabled && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950"
        >
          {status?.note ||
            statusError ||
            "AI features are disabled — set XAI_API_KEY on the server to enable. The rest of the app works as before."}
        </div>
      )}

      {enabled && status && (
        <p className="text-xs text-[var(--muted)]">
          Image: <code>{status.models.image.id}</code> ($
          {status.models.image.priceUsdPerImage.toFixed(2)}/image) · Vision:{" "}
          <code>{status.models.vision.id}</code> ($
          {status.models.vision.inputUsdPerMillionTokens.toFixed(2)}/$
          {status.models.vision.outputUsdPerMillionTokens.toFixed(2)} per 1M
          tokens) · Caps: {status.caps.perIpPerMinute}/min ·{" "}
          {status.caps.perIpPerDay}/IP/day · {status.caps.globalPerDay}
          /global/day
        </p>
      )}

      <div className="space-y-3">
        <div
          role="group"
          aria-label="Generate purpose"
          className="inline-flex rounded-xl bg-[var(--surface-muted)] p-1"
        >
          {(
            [
              { id: "background", label: "Background" },
              { id: "graphic", label: "Graphic layer" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!enabled}
              aria-pressed={purpose === item.id}
              onClick={() => setPurpose(item.id)}
              className={`min-h-[40px] rounded-lg px-4 text-sm font-medium disabled:opacity-40 ${
                purpose === item.id
                  ? "bg-white text-[var(--ink)] shadow-sm"
                  : "text-[var(--muted)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
            Prompt
          </span>
          <textarea
            value={prompt}
            disabled={!enabled || generating}
            maxLength={maxPrompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, maxPrompt))}
            rows={3}
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-[15px] text-[var(--ink)] outline-none focus:border-[var(--accent)] disabled:opacity-50"
            placeholder="Describe the background or decorative graphic…"
          />
          <span className="block text-xs text-[var(--muted)]">
            {prompt.length}/{maxPrompt}
          </span>
        </label>
        <button
          type="button"
          disabled={!enabled || generating || !prompt.trim()}
          onClick={() => void onGenerate()}
          className="min-h-[44px] rounded-full bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-40"
        >
          {generating
            ? "Generating…"
            : purpose === "background"
              ? "Generate background"
              : "Generate graphic layer"}
        </button>
        {genError && (
          <p className="text-sm text-[#b91c1c]" role="alert">
            {genError}
          </p>
        )}
      </div>

      {(design.graphics?.length ?? 0) > 0 && (
        <div className="space-y-3 border-t border-[var(--line)] pt-4">
          <h3 className="text-sm font-medium text-[var(--ink)]">
            Graphic layers
          </h3>
          <ul className="space-y-3">
            {design.graphics.map((layer, index) => (
              <li
                key={layer.id}
                className="space-y-2 rounded-xl bg-[var(--surface-muted)] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[var(--ink)]">
                    Layer {index + 1}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-[var(--muted)] hover:text-[#b91c1c]"
                    onClick={() => removeLayer(layer.id)}
                  >
                    Remove
                  </button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={layer.imageDataUrl}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <label className="block text-xs text-[var(--muted)]">
                  X {Math.round(layer.xPercent)}%
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={layer.xPercent}
                    onChange={(e) =>
                      updateLayer(layer.id, {
                        xPercent: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full"
                  />
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  Y {Math.round(layer.yPercent)}%
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={layer.yPercent}
                    onChange={(e) =>
                      updateLayer(layer.id, {
                        yPercent: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full"
                  />
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  Size {Math.round(layer.widthPercent)}%
                  <input
                    type="range"
                    min={8}
                    max={70}
                    value={layer.widthPercent}
                    onChange={(e) =>
                      updateLayer(layer.id, {
                        widthPercent: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full"
                  />
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3 border-t border-[var(--line)] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-[var(--ink)]">
            Screenshot suggestions
          </h3>
          <button
            type="button"
            disabled={!enabled || !source || analyzing}
            onClick={() => void runAnalyze()}
            className="min-h-[40px] rounded-full border border-[var(--line)] bg-white px-4 text-sm font-medium text-[var(--ink)] disabled:opacity-40"
          >
            {analyzing ? "Analyzing…" : "Analyze screenshot"}
          </button>
        </div>
        {!source && (
          <p className="text-sm text-[var(--muted)]">
            Upload a screenshot to analyze captions, layout, device, background,
            and palette.
          </p>
        )}
        {analyzeError && (
          <p className="text-sm text-[#b91c1c]" role="alert">
            {analyzeError}
          </p>
        )}
        {suggestions && (
          <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
            <p className="text-sm text-[var(--ink)]">
              <span className="font-medium">{suggestions.headline}</span>
              {suggestions.subtitle ? (
                <span className="mt-1 block text-[var(--muted)]">
                  {suggestions.subtitle}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-[var(--muted)]">
              Layout: {suggestions.layout} · Device: {suggestions.device} ·{" "}
              {suggestions.backgroundStyle.kind} background
              {suggestions.rationale ? ` — ${suggestions.rationale}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: "Apply all",
                  onClick: applyAll,
                },
                {
                  label: "Captions",
                  onClick: () => applyCaptions(suggestions, onPatchText),
                },
                {
                  label: "Layout",
                  onClick: () => applyLayout(suggestions, onPatchDesign),
                },
                {
                  label: "Device",
                  onClick: () =>
                    applyDevice(suggestions, platforms, onSetPlatforms),
                },
                {
                  label: "Background",
                  onClick: () => applyBackground(suggestions, onPatchDesign),
                },
                {
                  label: "Palette",
                  onClick: () =>
                    applyPalette(suggestions, onPatchText, onPatchDesign),
                },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="min-h-[36px] rounded-full bg-white px-3 text-xs font-medium text-[var(--ink)] ring-1 ring-[var(--line)] hover:ring-[var(--accent-soft)]"
                >
                  {action.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["text", suggestions.colorPalette.text],
                  ["background", suggestions.colorPalette.background],
                  ["accent", suggestions.colorPalette.accent],
                ] as const
              ).map(([name, color]) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-2 py-1 text-[11px] text-[var(--muted)] ring-1 ring-[var(--line)]"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-[var(--line)]"
                    style={{ backgroundColor: color }}
                  />
                  {name} {color}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function applyCaptions(
  suggestions: ScreenshotAiSuggestions,
  onPatchText: (partial: Partial<DesignState["text"]>) => void,
) {
  onPatchText({
    headline: suggestions.headline,
    subtitle: suggestions.subtitle,
    align: suggestions.textAlign,
    position: suggestions.textPosition,
  });
}

function applyLayout(
  suggestions: ScreenshotAiSuggestions,
  onPatchDesign: (partial: Partial<DesignState>) => void,
) {
  onPatchDesign({ layout: suggestions.layout });
}

function applyDevice(
  suggestions: ScreenshotAiSuggestions,
  platforms: PlatformId[],
  onSetPlatforms: (platforms: PlatformId[]) => void,
) {
  const device = suggestions.device as PlatformId;
  const known: PlatformId[] = [
    "iphone",
    "ipad",
    "mac",
    "watch",
    "dual",
    "header",
    "search",
  ];
  if (!known.includes(device)) return;
  if (platforms.includes(device)) return;
  onSetPlatforms([...platforms, device]);
}

function applyBackground(
  suggestions: ScreenshotAiSuggestions,
  onPatchDesign: (partial: Partial<DesignState>) => void,
) {
  onPatchDesign({ background: suggestions.backgroundStyle });
}

function applyPalette(
  suggestions: ScreenshotAiSuggestions,
  onPatchText: (partial: Partial<DesignState["text"]>) => void,
  onPatchDesign: (partial: Partial<DesignState>) => void,
) {
  onPatchText({ color: suggestions.colorPalette.text });
  if (suggestions.backgroundStyle.kind === "solid") {
    onPatchDesign({
      background: {
        kind: "solid",
        color: suggestions.colorPalette.background,
      },
    });
  } else {
    onPatchDesign({
      background: {
        kind: "gradient",
        from: suggestions.colorPalette.accent,
        to: suggestions.colorPalette.background,
        direction: suggestions.backgroundStyle.direction,
      },
    });
  }
}
