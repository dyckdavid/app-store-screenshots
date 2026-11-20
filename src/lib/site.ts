export const SITE_NAME = "ASC Studio";
export const SITE_TAGLINE = "App Store Connect screenshots, designed in your browser";
export const SITE_DESCRIPTION =
  "Design and export pixel-exact App Store Connect screenshots for iPhone, iPad, Mac and Apple Watch — device frames, dual layouts, captions, and AI copy. Free to start.";

/** Canonical origin: NEXT_PUBLIC_APP_URL, else Vercel URL, else localhost. */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod && process.env.VERCEL_ENV === "production") return `https://${prod}`;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:43123";
}

export const APPLE_DISCLAIMER =
  "Not affiliated with Apple Inc. Apple, iPhone, iPad, Mac and Apple Watch are trademarks of Apple Inc.";
