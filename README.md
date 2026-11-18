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

Open [http://localhost:43123](http://localhost:43123) for the landing page; the editor lives at [/studio](http://localhost:43123/studio).

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

Monetization variables (`DATABASE_URL`, `NEON_AUTH_*`, `STRIPE_*`, `BLOB_READ_WRITE_TOKEN`, `ALLOW_LIVE_STRIPE`, `QUOTA_*`, …) are documented with comments in [`.env.example`](./.env.example) and in **Monetization setup** below.

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

Metered AI routes require a signed-in user and consume DB-backed quotas (`usage_events`); they return `401` when signed out and `402` with `code: "quota_exceeded"` when over quota. The in-memory per-IP limiter remains as a secondary abuse guard (per instance).

## Monetization setup

The app ships with accounts (Neon Auth), free-vs-Pro gating, and Stripe **in test mode only**. With no env vars set, everything degrades gracefully: the anonymous editor at `/studio` works (exports carry a watermark), and account/billing/AI surfaces show a "not configured" state.

### What's gated where

| Value | Free | Pro ($9/mo, $79/yr) | Lifetime ($39) | Enforced |
| --- | --- | --- | --- | --- |
| All sizes & layouts | ✓ | ✓ | ✓ | — |
| Watermark-free exports | — | ✓ | ✓ | **client-side** (deterrent only) |
| AI actions | 3/day (signed in) | 150/month | 50/month | server: `usage_events` in Neon |
| Cloud presets | — | ✓ | ✓ | server: `/api/presets` |

Limits live in `src/lib/billing/plans.ts` and are env-overridable (`QUOTA_*`). Composition is client-side canvas, so the **watermark is a deterrent, not DRM** — a determined user can strip it. Server-enforced Pro value is AI quotas, cloud presets, and paid downloads.

**Heads-up when merging:** every metered `/api/ai/*` route now requires a signed-in user and a DB quota. Until Neon Auth and `DATABASE_URL` are configured in an environment, AI returns 503 there (`/api/ai/status` stays public and never returns keys).

### 1. Neon database + branches

1. Use the existing Neon project (or create one). Keep `main` = production; create a **preview** branch (empty, or from a schema-only parent). Never copy production rows to previews.
2. Copy the branch's pooled connection string → `DATABASE_URL`, and the direct one → `DATABASE_URL_UNPOOLED`.
3. Run migrations and the fake-data seed:
   ```bash
   DATABASE_URL_UNPOOLED=... npm run db:migrate
   DATABASE_URL_UNPOOLED=... npm run db:seed
   ```
   Migrations are tracked by drizzle-kit (safe to re-run on a fresh branch). The seed refuses to run when `VERCEL_ENV=production`. Schema changes: edit `src/db/schema.ts`, then `npm run db:generate`.

### 2. Neon Auth

1. Neon Console → your project → **Auth** → enable Neon Auth (Better Auth). Enable **Email OTP** and **Google**; optionally **Apple** (then set `NEXT_PUBLIC_AUTH_APPLE_ENABLED=true`).
2. Auth → **Domains**: add `http://localhost:43123`, the Vercel preview origin(s), and later the production origin.
3. Copy the Auth URL → `NEON_AUTH_BASE_URL`; generate `NEON_AUTH_COOKIE_SECRET` with `openssl rand -base64 32`.

Only `/account/*` and `/auth/callback` run the auth proxy (`src/proxy.ts`); route handlers enforce auth themselves with `requireUser()`.

### 3. Stripe (test mode)

1. Stripe Dashboard → toggle **Test mode** → Developers → API keys → copy the `sk_test_…` key → `STRIPE_SECRET_KEY`.
2. Create products/prices from `src/lib/billing/catalog.ts` (idempotent; refuses `sk_live_`):
   ```bash
   STRIPE_SECRET_KEY=sk_test_... DATABASE_URL_UNPOOLED=... npm run stripe:bootstrap
   ```
3. Settings → Billing → **Customer portal**: allow switching between Pro Monthly/Yearly, cancellation (at period end), and payment-method updates. Optionally copy its ID → `STRIPE_PORTAL_CONFIGURATION_ID`.
4. Developers → Webhooks → add endpoint `https://<preview-host>/api/stripe/webhook` with events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
5. Local development:
   ```bash
   stripe listen --forward-to localhost:43123/api/stripe/webhook
   ```
   and use the printed `whsec_…` as `STRIPE_WEBHOOK_SECRET` in `.env.local`.

Entitlements change **only** from verified webhooks, never from the checkout success redirect. The API version is pinned in `src/lib/billing/stripe.ts` (`2026-10-28.endive`, where `current_period_end` lives on subscription items).

### 4. Vercel Preview env vars (test keys only)

Project → Settings → Environment Variables → scope **Preview** only: `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (preview branch), `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `STRIPE_SECRET_KEY` (sk_test_), `STRIPE_WEBHOOK_SECRET`, `BLOB_READ_WRITE_TOKEN` (private Blob store), `NEXT_PUBLIC_APP_URL` (optional). Do **not** add any of these to Production yet.

### 5. Test cards

| Card | Result |
| --- | --- |
| `4242 4242 4242 4242` | Succeeds |
| `4000 0027 6000 3184` | Requires 3D Secure |
| `4000 0000 0000 0002` | Declined |

Any future expiry, any CVC, any postal code. If you enable OXXO in test mode, checkout completes as unpaid and the grant arrives with `checkout.session.async_payment_succeeded`.

### 6. Secure digital delivery

Paid files live in a **private** Vercel Blob store and are streamed by `GET /api/downloads/[assetId]` after an auth + entitlement check (logged in `download_events`); no permanent public URL is ever exposed. To sell a new file (e.g. an STL pack or an equipment-plan PDF):

1. Add a `digital` product + price to `src/lib/billing/catalog.ts`.
2. `npm run stripe:bootstrap`
3. `npm run asset:upload -- <product_key> ./path/to/file.zip`

Owners see it under `/account/library`.

### 7. Going live checklist (David only — requires explicit approval)

- [ ] **Frame licensing (pre-launch blocker):** `jonnyjackson26/device-frames-media` (iPhone 17 Pro Max, iPad frames) has **no license file** (see [NOTICE](./NOTICE)). Get written permission or replace those assets before charging money.
- [ ] Stripe **Mexico** account activation completed (payouts settle in MXN; USD prices are converted).
- [ ] Legal pages (`/terms`, `/privacy`, `/refund`) reviewed and the DRAFT banners removed.
- [ ] Tax decision with your contador: Stripe Tax can handle Mexican IVA for Mexico-to-Mexico sales only; foreign-customer tax obligations are separate. Then set `STRIPE_TAX_ENABLED` accordingly.
- [ ] Re-create the catalog in live mode (the bootstrap script is test-only by design).
- [ ] Live keys added in Vercel **Production** env only; set `ALLOW_LIVE_STRIPE=true` there.
- [ ] Live webhook endpoint registered with the same events.
- [ ] Production Neon branch migrated; Neon Auth production origin added.
- [ ] Domain + DNS (and update `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_WATERMARK_TEXT` if the badge domain differs).

## Coming soon

Listed in the UI. Includes freeform canvas dragging, per-shot caption overrides, app-preview video, In-App Event creatives, cloud preset sync, and additional official marketing frame packs.
