import type { CSSProperties, ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import {
  Fraunces,
  JetBrains_Mono,
  Outfit,
  Source_Sans_3,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import TestModeRibbon from "@/components/site/TestModeRibbon";
import { SITE_DESCRIPTION, SITE_NAME, appUrl } from "@/lib/site";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: "ASC Studio — App Store Connect screenshots",
    template: "%s · ASC Studio",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "ASC Studio — App Store Connect screenshots",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "ASC Studio — App Store Connect screenshots",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eef3f2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${outfit.variable} ${fraunces.variable} ${sourceSans.variable} ${jetbrains.variable}`}
      style={
        {
          "--font-ui": "var(--font-source-sans)",
          "--font-display": "var(--font-fraunces)",
        } as CSSProperties
      }
    >
      <body className="flex min-h-full flex-col">
        <TestModeRibbon />
        <SiteHeader />
        {children}
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
