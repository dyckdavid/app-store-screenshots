import type { DeviceLayout, TextAlign, TextPosition } from "@/lib/design";
import type { GradientDirection } from "@/lib/background";

export type AiGeneratePurpose = "background" | "graphic";

export type SuggestedDevice =
  | "iphone"
  | "ipad"
  | "mac"
  | "watch"
  | "dual"
  | "header"
  | "search"
  | "foldable";

export interface SuggestedSolidBackground {
  kind: "solid";
  color: string;
}

export interface SuggestedGradientBackground {
  kind: "gradient";
  from: string;
  to: string;
  direction: GradientDirection;
}

export type SuggestedBackground =
  | SuggestedSolidBackground
  | SuggestedGradientBackground;

export interface ScreenshotAiSuggestions {
  headline: string;
  subtitle: string;
  layout: DeviceLayout;
  device: SuggestedDevice;
  backgroundStyle: SuggestedBackground;
  colorPalette: {
    text: string;
    background: string;
    accent: string;
  };
  textAlign: TextAlign;
  textPosition: TextPosition;
  rationale: string;
}

export type CopyLocale =
  | "en"
  | "es"
  | "de"
  | "fr"
  | "pt"
  | "ja"
  | "zh-Hans"
  | "ko";

export interface LocalizedCopy {
  locale: CopyLocale;
  localeLabel: string;
  headline: string;
  subtitle: string;
}

export interface CopySuggestionsResponse {
  locales: LocalizedCopy[];
  model: string;
}

export interface ReviewIssue {
  id: string;
  severity: "info" | "warn" | "critical";
  category:
    | "readability"
    | "contrast"
    | "text-size"
    | "guideline"
    | "consistency";
  title: string;
  detail: string;
  /** Patch that one-click apply can merge into DesignState / text. */
  fix?: {
    text?: Partial<{
      headline: string;
      subtitle: string;
      color: string;
      headlineSize: number;
      subtitleSize: number;
      align: TextAlign;
      position: TextPosition;
      insetPercent: number;
    }>;
    layout?: DeviceLayout;
    background?: SuggestedBackground;
    frames?: boolean;
  };
}

export interface ReviewScorecard {
  overall: number;
  readability: number;
  contrast: number;
  textSize: number;
  guidelines: number;
  consistency: number;
  summary: string;
  issues: ReviewIssue[];
}

export interface AiStatusResponse {
  enabled: boolean;
  provider: "gateway" | "xai-direct" | "none";
  gateway: {
    configured: boolean;
    viaApiKey: boolean;
    viaOidc: boolean;
  };
  xaiDirect: {
    configured: boolean;
  };
  models: {
    image: {
      id: string;
      priceUsdPerImage: number;
      source: string;
    };
    vision: {
      id: string;
      inputUsdPerMillionTokens: number;
      outputUsdPerMillionTokens: number;
      source: string;
    };
    copy: {
      id: string;
    };
  };
  caps: {
    perIpPerMinute: number;
    perIpPerDay: number;
    globalPerDay: number;
    maxPromptLength: number;
    visionMaxEdge: number;
  };
  envVarsNeeded: string[];
  note: string | null;
}
