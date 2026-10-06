# ASC Screenshot Resizer

A browser tool that resizes screenshots to **App Store Connect** pixel sizes for **Mac**, **iPhone**, **iPad**, and **Apple Watch**.

Upload PNG/JPEG/WebP images, pick platforms, choose a solid or gradient background, optionally wrap each shot in a **real PNG device bezel**, then download individual PNGs or a ZIP. All composition runs client-side — no accounts, database, or API keys.

Every export is the **exact** ASC width × height. With frames on: cover-fill the screenshot into the device screen hole, then scale the framed composition (background + screen + PNG bezel) to the ASC canvas. Apple Watch uses a procedural bezel fallback (no open PNG in preferred sources).

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

## Pipeline (Origin → GitHub → Vercel)

One path. Do not create a second Vercel project.

1. **GitHub (deploy target):** [github.com/dyckdavid/app-store-screenshots](https://github.com/dyckdavid/app-store-screenshots) — `main` is what Vercel builds. This tree is a superset of the former native Origin `main` (commit `a08aafb` plus README pipeline docs).
2. **Origin (outbound mirror):** [cursor.com/codebase/david-dyck/app-store-screenshots](https://cursor.com/codebase/david-dyck/app-store-screenshots) will be re-created as a mirror of this GitHub repo, then switched to **outbound** so Origin pushes to GitHub. Prefer editing on Origin once that mirror is live; GitHub `main` stays the public remote Vercel watches.
3. **Vercel (auto-deploy):** project linked to the GitHub repo on team `computerjunges`. Production: [app-store-screenshots-computerjunges.vercel.app](https://app-store-screenshots-computerjunges.vercel.app) — every push to GitHub `main` triggers a production build.

No environment variables are required. Local CLI deploys (`npx vercel`) are optional and should target the same existing project only.
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
