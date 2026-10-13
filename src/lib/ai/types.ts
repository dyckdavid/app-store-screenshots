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
  | "search";

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

export interface AiStatusResponse {
  enabled: boolean;
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
  };
  caps: {
    perIpPerMinute: number;
    perIpPerDay: number;
    globalPerDay: number;
    maxPromptLength: number;
    visionMaxEdge: number;
  };
  note: string | null;
}
