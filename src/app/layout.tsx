import type { CSSProperties, ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import {
  Fraunces,
  JetBrains_Mono,
  Outfit,
  Source_Sans_3,
} from "next/font/google";
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
  title: "ASC Studio — App Store Connect screenshots",
  description:
    "Design and export App Store Connect screenshots, dual-device layouts, product page headers, and search creatives — entirely in your browser.",
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
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
