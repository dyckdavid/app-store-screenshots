# ASC Studio

Browser tool that designs and exports **App Store Connect** marketing assets for **iPhone**, **iPad**, **Mac**, **Apple Watch**, plus **product page headers**, **search results creatives**, and **dual-iPhone** layouts.

Upload PNG/JPEG/WebP screenshots → design a consistent set (caption, fonts, templates, backgrounds, frames) → export individual PNGs or a ZIP of every selected size. Composition runs client-side. Optional **xAI Grok** features (image generation + vision suggestions) call the API only from Next.js route handlers.

## Workflow

1. **Upload** — drop one or more screenshots; they form a multi-shot set with shared style. When AI is enabled, the active shot can be analyzed for styling suggestions.
2. **Design** — caption/headline + subtitle, font (bundled Google + web-safe), size/weight/color/alignment, top/bottom position, layout templates, solid/gradient/**image** backgrounds, placeable decorative graphic layers, single or dual-device layouts, live canvas preview with alignment/snap helpers, saveable presets (`localStorage`), optional AI generate + one-click apply suggestions.
3. **Export** — select platforms/creative targets, batch-export all screenshots × all selected ASC sizes as opaque PNGs (ZIP).

## Frame compose rule (do not regress)

With device frames on:

1. **Cover-fill** the screenshot into the device screen / mask rect (never letterbox inside the screen).
2. **Then** scale the whole framed composition (background + screen + PNG bezel) to the exact ASC canvas using contain or cover.

Covered by unit tests in `src/lib/geometry.test.ts`.

## Apple specifications (sources)

### Screenshots

Source: [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

Primary sizes this tool emits (one accepted size per display class):

| Platform | Example size | Notes |
| --- | --- | --- |
| iPhone 6.9" | 1320×2868 / 2868×1320 | Dynamic Island large display |
| iPhone 6.5" | 1284×2778 / 2778×1284 | Fallback when 6.9" not provided |
| iPad 13" | 2064×2752 / 2752×2064 | Required if app runs on iPad |
| iPad 11" | 1668×2420 / 2420×1668 | Optional |
| Mac | 2880×1800 (and other 16:10) | Required for Mac apps |
| Apple Watch | e.g. 422×514 (Ultra 4) | Required for Watch apps |

### Creative assets — product page header & search results

Source: [Creative assets specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications/)

Context: [App Store asset best practices](https://developer.apple.com/app-store/asset-best-practices/)

| Placement | Aspect | Resolution used here | Notes |
| --- | --- | --- | --- |
| Product page header | 21:9 | **3840×1646** | Exact size from Apple’s table |
| Universal creative | 16:9 | **5244×2950** | Listed for header/search (PNG) |
| Search results | 3:2 | **3840×2560** | Apple documents min 1920×1280 and max 3840×2560 — **assumption: export at maximum** |

Images must be JPEG/JPG/PNG **without alpha**; this tool always encodes opaque RGB PNGs.

### Dual iPhone layouts

Not an Apple-required “size class” — compositions of two framed iPhones exported at the primary iPhone ASC canvas (1320×2868 portrait / 2868×1320 landscape). Variants: side-by-side, overlapping, angled.

## Device frames

Real PNG bezels from open community sources (see [NOTICE](./NOTICE)):

- **iPhone 17 Pro Max** Deep Blue (`jonnyjackson26/device-frames-media`)
- iPad Pro 13" / 11" Space Black
- MacBook (MIT `bunlongheng/frames`)
- Apple Watch: procedural bezel fallback

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:43123](http://localhost:43123).

```bash
npm run test
npm run lint
npm run build
npm start
```

## Pipeline (Origin → GitHub → Vercel)

1. **GitHub:** [github.com/dyckdavid/app-store-screenshots](https://github.com/dyckdavid/app-store-screenshots) — `main` is what Vercel builds.
2. **Vercel:** team `computerjunges` — production [app-store-screenshots-computerjunges.vercel.app](https://app-store-screenshots-computerjunges.vercel.app). Pushes to `main` deploy production; PRs get preview deployments.

### Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `XAI_API_KEY` | No | _(unset)_ | Server-only xAI API key. If missing, AI UI is disabled with a clear note; upload/design/export work as before. |
| `XAI_RATE_LIMIT_PER_IP_PER_MINUTE` | No | `5` | Max AI route calls per client IP per minute |
| `XAI_RATE_LIMIT_PER_IP_PER_DAY` | No | `30` | Max AI route calls per client IP per UTC day |
| `XAI_RATE_LIMIT_GLOBAL_PER_DAY` | No | `200` | Max AI route calls across all IPs per UTC day |
| `XAI_MAX_PROMPT_LENGTH` | No | `500` | Max characters for image-generation prompts |
| `XAI_VISION_MAX_EDGE` | No | `768` | Longest edge (px) for vision payloads (client downscales) |
| `XAI_VISION_MAX_BASE64_CHARS` | No | `900000` | Server reject threshold for vision base64 payloads |

Copy `.env.example` → `.env.local` for local development. Set `XAI_API_KEY` in the Vercel project for preview/production AI.

### AI models & pricing (xAI)

Chosen as the **cheapest** options available on [docs.x.ai models](https://docs.x.ai/docs/models) / [pricing](https://docs.x.ai/developers/pricing) at implementation time:

| Feature | Model id | Price | Source |
| --- | --- | --- | --- |
| Background / graphic generation | `grok-imagine-image` | **$0.02 / image** | [Imagine Pricing](https://docs.x.ai/docs/models) · [model page](https://docs.x.ai/docs/models/grok-imagine-image) |
| Screenshot vision analysis | `grok-build-0.1` | **$1.00 / 1M input** · **$2.00 / 1M output** tokens (&lt; 200k prompt) | [Text API Pricing](https://docs.x.ai/docs/models) · [model page](https://docs.x.ai/docs/models/grok-build-0.1) (modalities: text, image → text) |

Server routes:

- `GET /api/ai/status` — whether AI is enabled + public model/cap metadata (never returns the key)
- `POST /api/ai/generate-image` — `{ prompt, purpose: "background" \| "graphic" }` → data URL
- `POST /api/ai/analyze` — `{ imageDataUrl }` (downscaled JPEG/PNG) → structured suggestions

Rate limits are enforced in-memory per server instance (per-IP minute/day + global day). For multi-instance production, replace with a shared store (Redis/KV).

## Coming soon

Listed in the UI. Includes freeform canvas dragging, per-shot caption overrides, app-preview video, In-App Event creatives, localization packs, cloud preset sync, and additional official marketing frame packs.
