# ASC Studio

Browser tool that designs and exports **App Store Connect** marketing assets for **iPhone**, **iPad**, **Mac**, **Apple Watch**, plus **product page headers**, **search results creatives**, **dual-iPhone** layouts (all iPhone ASC sizes), and an **MIT foldable iPhone Duo** frame.

Upload PNG/JPEG/WebP screenshots → guided flow (upload → devices → style → AI review → export) → export individual PNGs or a ZIP. Composition runs client-side. Optional AI (Vercel AI Gateway + AI SDK, with direct xAI fallback) calls only from Next.js route handlers.

## Guided workflow

1. **Upload** — drop one or more screenshots; drag thumbs to reorder. Dual layouts pair each shot with the next.
2. **Devices** — pick single / side-by-side / overlap / tilted / foldable open|closed, and ASC export targets.
3. **Style** — captions, fonts, templates, backgrounds, presets (`localStorage`).
4. **AI review** — multilingual copy (incl. Spanish), background/color suggestions, auto layout pick, scorecard with one-click fixes.
5. **Export** — batch opaque PNGs at exact ASC pixel sizes (ZIP).

## Frame compose rule (do not regress)

With device frames on:

1. **Cover-fill** the screenshot into the device screen / mask rect (never letterbox inside the screen).
2. **Then** scale the whole framed composition (background + screen + PNG bezel) to the exact ASC canvas using contain or cover.

Covered by unit tests in `src/lib/geometry.test.ts`.

## Dual iPhone layouts

First-class across **all** iPhone ASC sizes (6.9″ / 6.5″ / 6.3″ / 6.1″, portrait + landscape), plus the Dual platform target. Variants: side-by-side, overlapping, tilted. Each device uses its own screenshot from the ordered set.

## Foldable iPhone Duo frame

**Added** from [bunlongheng/frames](https://github.com/bunlongheng/frames) (**MIT**): closed, open-portrait, and open-landscape PNG bezels under `public/frames/iphone-duo/`.

**Why this source:** Hoverify and Screeny Duo PNGs disallow redistribution as an asset pack; jal-co/iphone-duo ships Apple’s GLB (not openly licensed for bezel redistribution). bunlongheng/frames is MIT and already used for MacBook.

## Apple specifications (sources)

### Screenshots

Source: [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

### Creative assets — product page header & search results

Source: [Creative assets specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications/)

| Placement | Aspect | Resolution used here |
| --- | --- | --- |
| Product page header | 21:9 | **3840×1646** |
| Universal creative | 16:9 | **5244×2950** |
| Search results | 3:2 | **3840×2560** (Apple max) |

Images must be JPEG/JPG/PNG **without alpha**; this tool always encodes opaque RGB PNGs.

## Device frames

Real PNG bezels from open community sources (see [NOTICE](./NOTICE)):

- **iPhone 17 Pro Max** Deep Blue (`jonnyjackson26/device-frames-media`)
- **iPhone Duo** foldable closed/open (MIT `bunlongheng/frames`)
- iPad Pro 13" / 11" Space Black
- MacBook (MIT `bunlongheng/frames`)
- Apple Watch: procedural bezel fallback

## Run locally

```bash
npm install
cp .env.example .env.local   # optional AI keys
npm run dev
```

Open [http://localhost:43123](http://localhost:43123).

```bash
npm run test
npm run lint
npm run build
npm start
```

## Pipeline (GitHub → Vercel)

1. **GitHub:** [github.com/dyckdavid/app-store-screenshots](https://github.com/dyckdavid/app-store-screenshots) — `main` is what Vercel builds.
2. **Vercel:** team `computerjunges` — production [app-store-screenshots-computerjunges.vercel.app](https://app-store-screenshots-computerjunges.vercel.app). Pushes to `main` deploy production; PRs get preview deployments.

### Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `AI_GATEWAY_API_KEY` | No* | _(unset)_ | Vercel AI Gateway key (preferred for local + preview). |
| `VERCEL_OIDC_TOKEN` | No* | _(auto on Vercel)_ | OIDC auth for Gateway on Vercel deployments. |
| `XAI_API_KEY` | No* | _(unset)_ | Direct xAI fallback when Gateway creds are absent. |
| `XAI_RATE_LIMIT_PER_IP_PER_MINUTE` | No | `5` | Max AI route calls per client IP per minute |
| `XAI_RATE_LIMIT_PER_IP_PER_DAY` | No | `30` | Max AI route calls per client IP per UTC day |
| `XAI_RATE_LIMIT_GLOBAL_PER_DAY` | No | `200` | Max AI route calls across all IPs per UTC day |
| `XAI_MAX_PROMPT_LENGTH` | No | `500` | Max characters for image-generation prompts |
| `XAI_VISION_MAX_EDGE` | No | `768` | Longest edge (px) for vision payloads |
| `XAI_VISION_MAX_BASE64_CHARS` | No | `900000` | Server reject threshold for vision payloads |

\*AI UI enables when **any** of Gateway key, OIDC, or `XAI_API_KEY` is present. If none are set, the rest of the app works and AI panels show exactly what to configure.

### AI models (via Vercel AI Gateway)

| Feature | Gateway model id | Notes |
| --- | --- | --- |
| Background / graphic generation | `spacexai/grok-imagine-image` | ~$0.02 / image (xAI Imagine) |
| Vision / review / layout / copy | `spacexai/grok-build-0.1` | Cheapest vision-capable Grok text model |

Integration: Vercel AI SDK (`ai` + plain `provider/model` strings). Server routes:

- `GET /api/ai/status` — enabled flag, provider path, models, caps (never returns keys)
- `POST /api/ai/generate-image` — background / graphic
- `POST /api/ai/analyze` — style suggestions from a screenshot
- `POST /api/ai/copy` — multilingual headline/caption packs
- `POST /api/ai/layout` — auto-pick best device layout
- `POST /api/ai/review` — scorecard + one-click fixes

Rate limits are in-memory per server instance. For multi-instance production, replace with Redis/KV.

## Coming soon

Listed in the UI. Includes freeform canvas dragging, per-shot caption overrides, app-preview video, In-App Event creatives, cloud preset sync, and additional official marketing frame packs.
