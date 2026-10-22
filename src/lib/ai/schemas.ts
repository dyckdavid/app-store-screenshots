import { z } from "zod";

export const deviceLayoutSchema = z.enum([
  "single",
  "dual-side",
  "dual-overlap",
  "dual-angled",
  "foldable-closed",
  "foldable-open",
]);

export const suggestedDeviceSchema = z.enum([
  "iphone",
  "ipad",
  "mac",
  "watch",
  "dual",
  "header",
  "search",
  "foldable",
]);

export const textAlignSchema = z.enum(["left", "center", "right"]);
export const textPositionSchema = z.enum(["top", "bottom"]);

export const backgroundSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("solid"),
    color: z.string(),
  }),
  z.object({
    kind: z.literal("gradient"),
    from: z.string(),
    to: z.string(),
    direction: z.enum([
      "vertical",
      "horizontal",
      "diagonal-down",
      "diagonal-up",
    ]),
  }),
]);

export const suggestionsSchema = z.object({
  headline: z.string().max(48),
  subtitle: z.string().max(64),
  layout: deviceLayoutSchema,
  device: suggestedDeviceSchema,
  backgroundStyle: backgroundSchema,
  colorPalette: z.object({
    text: z.string(),
    background: z.string(),
    accent: z.string(),
  }),
  textAlign: textAlignSchema,
  textPosition: textPositionSchema,
  rationale: z.string().max(200),
});

export const copyLocaleSchema = z.enum([
  "en",
  "es",
  "de",
  "fr",
  "pt",
  "ja",
  "zh-Hans",
  "ko",
]);

export const localizedCopySchema = z.object({
  locales: z.array(
    z.object({
      locale: copyLocaleSchema,
      localeLabel: z.string(),
      headline: z.string().max(48),
      subtitle: z.string().max(64),
    }),
  ),
});

export const reviewSchema = z.object({
  overall: z.number().min(0).max(100),
  readability: z.number().min(0).max(100),
  contrast: z.number().min(0).max(100),
  textSize: z.number().min(0).max(100),
  guidelines: z.number().min(0).max(100),
  consistency: z.number().min(0).max(100),
  summary: z.string().max(240),
  issues: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(["info", "warn", "critical"]),
      category: z.enum([
        "readability",
        "contrast",
        "text-size",
        "guideline",
        "consistency",
      ]),
      title: z.string().max(80),
      detail: z.string().max(240),
      fix: z
        .object({
          text: z
            .object({
              headline: z.string().optional(),
              subtitle: z.string().optional(),
              color: z.string().optional(),
              headlineSize: z.number().optional(),
              subtitleSize: z.number().optional(),
              align: textAlignSchema.optional(),
              position: textPositionSchema.optional(),
              insetPercent: z.number().optional(),
            })
            .optional(),
          layout: deviceLayoutSchema.optional(),
          background: backgroundSchema.optional(),
          frames: z.boolean().optional(),
        })
        .optional(),
    }),
  ),
});

export const layoutPickSchema = z.object({
  layout: deviceLayoutSchema,
  rationale: z.string().max(200),
  confidence: z.number().min(0).max(1),
});
