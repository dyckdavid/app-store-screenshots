# ASC Screenshot Resizer

A browser tool that resizes screenshots to **App Store Connect** pixel sizes for **Mac**, **iPhone**, **iPad**, and **Apple Watch**.

Upload PNG/JPEG/WebP images, pick platforms, choose a solid or gradient background, optionally wrap each shot in a **real PNG device bezel**, then download individual PNGs or a ZIP. All composition runs client-side — no accounts, database, or API keys.

Every export is the **exact** ASC width × height. Composition: background → screenshot (masked to the screen) → PNG frame overlay. Apple Watch uses a procedural bezel fallback (no open PNG in preferred sources).

Frame assets live under `public/frames/` — see [NOTICE](./NOTICE) for sources and attribution.

Sizes follow Apple’s published [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:43123](http://localhost:43123).

```bash
npm run build
npm start
```

## Deploy on Vercel

1. Push this repo to GitHub / Origin.
2. Import the project in [Vercel](https://vercel.com/new).
3. Deploy with defaults — **no environment variables** are required.

Or from the CLI:

```bash
npx vercel
```

## How to use

1. Drop or pick one or more screenshots (PNG, JPEG, WebP).
2. Select platforms (all selected by default).
3. Pick a **Background** — solid color (presets + picker) or gradient (two colors + direction).
4. Toggle **Device frames** on for PNG bezels (iPhone / iPad / MacBook) or the Watch procedural bezel.
5. Choose **Contain** or **Cover** resize mode.
6. **Generate sizes**, then download individual PNGs or a ZIP of every size.

## Stack

- Next.js 16 (App Router) + React 19
- Tailwind CSS 4
- Client-side canvas compose + `fast-png` (opaque RGB) + JSZip
