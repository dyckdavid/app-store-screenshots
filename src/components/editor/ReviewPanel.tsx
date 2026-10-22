"use client";

import { useCallback, useEffect, useState } from "react";
import {
  analyzeScreenshot,
  downscaleImageForVision,
  fetchAiStatus,
  generateAiImage,
  generateLocalizedCopy,
  pickBestLayout,
  reviewComposition,
} from "@/lib/ai/client";
import type {
  AiStatusResponse,
  CopyLocale,
  LocalizedCopy,
  ReviewIssue,
  ReviewScorecard,
  ScreenshotAiSuggestions,
} from "@/lib/ai/types";
import type { DesignState } from "@/lib/design";
import type { PlatformId } from "@/lib/sizes";
import type { SourceImage } from "@/lib/resize";
import { createGraphicLayer, type GraphicLayer } from "@/lib/graphics";

interface ReviewPanelProps {
  source: SourceImage | null;
  sourcesCount: number;
  design: DesignState;
  onPatchDesign: (partial: Partial<DesignState>) => void;
  onPatchText: (partial: Partial<DesignState["text"]>) => void;
  platforms: PlatformId[];
  onSetPlatforms: (platforms: PlatformId[]) => void;
  analyzeToken: number;
}

const COPY_LOCALES: CopyLocale[] = ["en", "es", "de", "fr", "pt", "ja"];

export default function ReviewPanel({
  source,
  sourcesCount,
  design,
  onPatchDesign,
  onPatchText,
  platforms,
  onSetPlatforms,
  analyzeToken,
}: ReviewPanelProps) {
  const [status, setStatus] = useState<AiStatusResponse | null>(null);
  const [prompt, setPrompt] = useState(
    "Soft teal mist with subtle geometric light rays",
  );
  const [purpose, setPurpose] = useState<"background" | "graphic">(
    "background",
  );
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [picking, setPicking] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [suggestions, setSuggestions] =
    useState<ScreenshotAiSuggestions | null>(null);
  const [copies, setCopies] = useState<LocalizedCopy[]>([]);
  const [layoutPick, setLayoutPick] = useState<{
    layout: DesignState["layout"];
    rationale: string;
    confidence: number;
  } | null>(null);
  const [review, setReview] = useState<ReviewScorecard | null>(null);
  const [lastAnalyzedKey, setLastAnalyzedKey] = useState<string | null>(null);
  const [selectedLocales, setSelectedLocales] = useState<CopyLocale[]>([
    "en",
    "es",
  ]);

  useEffect(() => {
    let cancelled = false;
    void fetchAiStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({
            enabled: false,
            provider: "none",
            gateway: { configured: false, viaApiKey: false, viaOidc: false },
            xaiDirect: { configured: false },
            models: {
              image: {
                id: "spacexai/grok-imagine-image",
                priceUsdPerImage: 0.02,
                source: "",
              },
              vision: {
                id: "spacexai/grok-build-0.1",
                inputUsdPerMillionTokens: 1,
                outputUsdPerMillionTokens: 2,
                source: "",
              },
              copy: { id: "spacexai/grok-build-0.1" },
            },
            caps: {
              perIpPerMinute: 5,
              perIpPerDay: 30,
              globalPerDay: 200,
              maxPromptLength: 500,
              visionMaxEdge: 768,
            },
            envVarsNeeded: [
              "AI_GATEWAY_API_KEY (or OIDC on Vercel)",
              "XAI_API_KEY (optional)",
            ],
            note: "AI features are disabled — set AI_GATEWAY_API_KEY or XAI_API_KEY.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visionDataUrl = useCallback(async () => {
    if (!source || !status) throw new Error("No screenshot");
    return downscaleImageForVision(source.bitmap, status.caps.visionMaxEdge);
  }, [source, status]);

  const runAnalyze = useCallback(async () => {
    if (!source || !status?.enabled) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const imageDataUrl = await visionDataUrl();
      const { suggestions: next } = await analyzeScreenshot({ imageDataUrl });
      setSuggestions(next);
      setLastAnalyzedKey(source.id);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }, [source, status, visionDataUrl]);

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

  const onCopy = useCallback(async () => {
    if (!status?.enabled || !source) return;
    setCopying(true);
    setCopyError(null);
    try {
      const imageDataUrl = await visionDataUrl();
      const result = await generateLocalizedCopy({
        imageDataUrl,
        contextHeadline: design.text.headline,
        contextSubtitle: design.text.subtitle,
        locales: selectedLocales,
      });
      setCopies(result.locales);
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "Copy failed.");
    } finally {
      setCopying(false);
    }
  }, [
    status?.enabled,
    source,
    visionDataUrl,
    design.text,
    selectedLocales,
  ]);

  const onPickLayout = useCallback(async () => {
    if (!status?.enabled || !source) return;
    setPicking(true);
    setLayoutError(null);
    try {
      const imageDataUrl = await visionDataUrl();
      const result = await pickBestLayout({
        imageDataUrl,
        screenshotCount: sourcesCount,
      });
      setLayoutPick({
        layout: result.layout,
        rationale: result.rationale,
        confidence: result.confidence,
      });
    } catch (err) {
      setLayoutError(err instanceof Error ? err.message : "Layout pick failed.");
    } finally {
      setPicking(false);
    }
  }, [status?.enabled, source, visionDataUrl, sourcesCount]);

  const onReview = useCallback(async () => {
    if (!status?.enabled || !source) return;
    setReviewing(true);
    setReviewError(null);
    try {
      const imageDataUrl = await visionDataUrl();
      const result = await reviewComposition({
        imageDataUrl,
        headline: design.text.headline,
        subtitle: design.text.subtitle,
        layout: design.layout,
      });
      setReview(result.review);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Review failed.");
    } finally {
      setReviewing(false);
    }
  }, [status?.enabled, source, visionDataUrl, design]);

  const applyIssue = useCallback(
    (issue: ReviewIssue) => {
      if (!issue.fix) return;
      if (issue.fix.text) onPatchText(issue.fix.text);
      if (issue.fix.layout) onPatchDesign({ layout: issue.fix.layout });
      if (issue.fix.background)
        onPatchDesign({ background: issue.fix.background });
      if (typeof issue.fix.frames === "boolean")
        onPatchDesign({ frames: issue.fix.frames });
    },
    [onPatchDesign, onPatchText],
  );

  const applyAllSuggestions = useCallback(() => {
    if (!suggestions) return;
    onPatchText({
      headline: suggestions.headline,
      subtitle: suggestions.subtitle,
      align: suggestions.textAlign,
      position: suggestions.textPosition,
      color: suggestions.colorPalette.text,
    });
    onPatchDesign({
      layout: suggestions.layout,
      background: suggestions.backgroundStyle,
    });
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
    if (known.includes(device) && !platforms.includes(device)) {
      onSetPlatforms([...platforms, device]);
    }
  }, [suggestions, onPatchText, onPatchDesign, platforms, onSetPlatforms]);

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
    <div className="space-y-4">
      <section className="space-y-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
        <h3 className="text-sm font-medium text-[var(--ink)]">AI status</h3>
        {!enabled && (
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950"
          >
            <p className="font-medium">AI disabled on this deployment</p>
            <p className="mt-1">
              {status?.note ||
                "David must set AI_GATEWAY_API_KEY (or rely on Vercel OIDC), or XAI_API_KEY as a direct fallback."}
            </p>
            {status?.envVarsNeeded && (
              <ul className="mt-2 list-disc pl-5 text-xs">
                {status.envVarsNeeded.map((v) => (
                  <li key={v}>
                    <code>{v}</code>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {enabled && status && (
          <p className="text-xs text-[var(--muted)]">
            Provider: <code>{status.provider}</code>
            {status.provider === "gateway"
              ? status.gateway.viaApiKey
                ? " (AI_GATEWAY_API_KEY)"
                : " (OIDC)"
              : " (XAI_API_KEY fallback)"}{" "}
            · Image <code>{status.models.image.id}</code> · Vision{" "}
            <code>{status.models.vision.id}</code> · Caps{" "}
            {status.caps.perIpPerMinute}/min · {status.caps.perIpPerDay}/IP/day
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-[var(--ink)]">
            Style suggestions
          </h3>
          <button
            type="button"
            disabled={!enabled || !source || analyzing}
            onClick={() => void runAnalyze()}
            className="min-h-[40px] rounded-full border border-[var(--line)] bg-white px-4 text-sm font-medium disabled:opacity-40"
          >
            {analyzing ? "Analyzing…" : "Analyze screenshot"}
          </button>
        </div>
        {!source && (
          <p className="text-sm text-[var(--muted)]">
            Upload a screenshot to analyze.
          </p>
        )}
        {analyzeError && (
          <p className="text-sm text-[#b91c1c]" role="alert">
            {analyzeError}
          </p>
        )}
        {suggestions && (
          <div className="space-y-2 rounded-xl bg-[var(--surface-muted)] p-3">
            <p className="text-sm font-medium">{suggestions.headline}</p>
            {suggestions.subtitle && (
              <p className="text-sm text-[var(--muted)]">
                {suggestions.subtitle}
              </p>
            )}
            <p className="text-xs text-[var(--muted)]">
              {suggestions.layout} · {suggestions.device}
              {suggestions.rationale ? ` — ${suggestions.rationale}` : ""}
            </p>
            <button
              type="button"
              onClick={applyAllSuggestions}
              className="min-h-[36px] rounded-full bg-[var(--ink)] px-4 text-xs font-medium text-white"
            >
              Apply all suggestions
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-[var(--ink)]">
            Multilingual copy
          </h3>
          <button
            type="button"
            disabled={!enabled || !source || copying}
            onClick={() => void onCopy()}
            className="min-h-[40px] rounded-full border border-[var(--line)] bg-white px-4 text-sm font-medium disabled:opacity-40"
          >
            {copying ? "Writing…" : "Generate copy"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {COPY_LOCALES.map((locale) => {
            const on = selectedLocales.includes(locale);
            return (
              <button
                key={locale}
                type="button"
                disabled={!enabled}
                onClick={() =>
                  setSelectedLocales((prev) =>
                    on
                      ? prev.length === 1
                        ? prev
                        : prev.filter((l) => l !== locale)
                      : [...prev, locale],
                  )
                }
                className={`min-h-[36px] rounded-full px-3 text-xs font-medium disabled:opacity-40 ${
                  on
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface-muted)]"
                }`}
              >
                {locale}
              </button>
            );
          })}
        </div>
        {copyError && (
          <p className="text-sm text-[#b91c1c]" role="alert">
            {copyError}
          </p>
        )}
        {copies.length > 0 && (
          <ul className="space-y-2">
            {copies.map((row) => (
              <li
                key={row.locale}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-[var(--surface-muted)] p-3"
              >
                <div>
                  <p className="text-xs text-[var(--muted)]">
                    {row.localeLabel} ({row.locale})
                  </p>
                  <p className="text-sm font-medium">{row.headline}</p>
                  <p className="text-sm text-[var(--muted)]">{row.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onPatchText({
                      headline: row.headline,
                      subtitle: row.subtitle,
                    })
                  }
                  className="min-h-[36px] rounded-full bg-white px-3 text-xs font-medium ring-1 ring-[var(--line)]"
                >
                  Apply
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-[var(--ink)]">
            Auto-pick layout
          </h3>
          <button
            type="button"
            disabled={!enabled || !source || picking}
            onClick={() => void onPickLayout()}
            className="min-h-[40px] rounded-full border border-[var(--line)] bg-white px-4 text-sm font-medium disabled:opacity-40"
          >
            {picking ? "Choosing…" : "Pick best layout"}
          </button>
        </div>
        {layoutError && (
          <p className="text-sm text-[#b91c1c]" role="alert">
            {layoutError}
          </p>
        )}
        {layoutPick && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)] p-3">
            <div>
              <p className="text-sm font-medium">{layoutPick.layout}</p>
              <p className="text-xs text-[var(--muted)]">
                {layoutPick.rationale} · confidence{" "}
                {Math.round(layoutPick.confidence * 100)}%
              </p>
            </div>
            <button
              type="button"
              onClick={() => onPatchDesign({ layout: layoutPick.layout })}
              className="min-h-[36px] rounded-full bg-[var(--ink)] px-4 text-xs font-medium text-white"
            >
              Apply layout
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-[var(--ink)]">
            Output scorecard
          </h3>
          <button
            type="button"
            disabled={!enabled || !source || reviewing}
            onClick={() => void onReview()}
            className="min-h-[40px] rounded-full border border-[var(--line)] bg-white px-4 text-sm font-medium disabled:opacity-40"
          >
            {reviewing ? "Scoring…" : "Run AI review"}
          </button>
        </div>
        {reviewError && (
          <p className="text-sm text-[#b91c1c]" role="alert">
            {reviewError}
          </p>
        )}
        {review && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--ink)]">{review.summary}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(
                [
                  ["Overall", review.overall],
                  ["Readability", review.readability],
                  ["Contrast", review.contrast],
                  ["Text size", review.textSize],
                  ["Guidelines", review.guidelines],
                  ["Consistency", review.consistency],
                ] as const
              ).map(([label, score]) => (
                <div
                  key={label}
                  className="rounded-xl bg-[var(--surface-muted)] px-3 py-2"
                >
                  <p className="text-[11px] text-[var(--muted)]">{label}</p>
                  <p className="text-lg font-semibold text-[var(--ink)]">
                    {score}
                  </p>
                </div>
              ))}
            </div>
            {review.issues.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No concrete issues flagged.
              </p>
            ) : (
              <ul className="space-y-2">
                {review.issues.map((issue) => (
                  <li
                    key={issue.id}
                    className="rounded-xl border border-[var(--line)] bg-white p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[var(--ink)]">
                          [{issue.severity}] {issue.title}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {issue.category} — {issue.detail}
                        </p>
                      </div>
                      {issue.fix && (
                        <button
                          type="button"
                          onClick={() => applyIssue(issue)}
                          className="min-h-[36px] rounded-full bg-[var(--accent)] px-3 text-xs font-medium text-white"
                        >
                          Apply fix
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
        <h3 className="text-sm font-medium text-[var(--ink)]">
          Generate background / graphic
        </h3>
        <div className="inline-flex rounded-xl bg-[var(--surface-muted)] p-1">
          {(
            [
              { id: "background", label: "Background" },
              { id: "graphic", label: "Graphic" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!enabled}
              onClick={() => setPurpose(item.id)}
              className={`min-h-[36px] rounded-lg px-4 text-sm disabled:opacity-40 ${
                purpose === item.id
                  ? "bg-white shadow-sm"
                  : "text-[var(--muted)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <textarea
          value={prompt}
          disabled={!enabled || generating}
          maxLength={maxPrompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, maxPrompt))}
          rows={3}
          className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-[15px] disabled:opacity-50"
        />
        <button
          type="button"
          disabled={!enabled || generating || !prompt.trim()}
          onClick={() => void onGenerate()}
          className="min-h-[44px] rounded-full bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-40"
        >
          {generating ? "Generating…" : "Generate"}
        </button>
        {genError && (
          <p className="text-sm text-[#b91c1c]" role="alert">
            {genError}
          </p>
        )}
        {(design.graphics?.length ?? 0) > 0 && (
          <ul className="space-y-2">
            {design.graphics.map((layer, index) => (
              <li
                key={layer.id}
                className="rounded-xl bg-[var(--surface-muted)] p-3"
              >
                <div className="flex justify-between gap-2">
                  <span className="text-sm">Layer {index + 1}</span>
                  <button
                    type="button"
                    className="text-xs text-[var(--muted)]"
                    onClick={() => removeLayer(layer.id)}
                  >
                    Remove
                  </button>
                </div>
                <label className="mt-2 block text-xs text-[var(--muted)]">
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
        )}
      </section>
    </div>
  );
}
