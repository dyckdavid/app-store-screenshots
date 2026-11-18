import type { Metadata } from "next";
import Link from "next/link";
import PricingCards from "@/components/site/PricingCards";
import { SITE_DESCRIPTION, SITE_NAME, appUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "ASC Studio — App Store Connect screenshots, designed in your browser" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

const FEATURES = [
  {
    title: "Every ASC size, pixel-exact",
    body: "iPhone 6.9″/6.5″/6.3″/6.1″, iPad 13″/11″, Mac, and Apple Watch — exported as opaque RGB PNGs App Store Connect accepts.",
  },
  {
    title: "Real device frames",
    body: "iPhone 17 Pro Max, iPad Pro, MacBook bezels, and a foldable iPhone Duo frame. Screenshots cover-fill the screen, then scale to the canvas.",
  },
  {
    title: "Dual-iPhone layouts",
    body: "Side-by-side, overlapping, and tilted pairs across every iPhone size, each device showing its own screenshot.",
  },
  {
    title: "Headers & search creatives",
    body: "Product page headers (21:9), universal creatives (16:9), and search results art (3:2) from the same design.",
  },
  {
    title: "Captions, fonts, backgrounds",
    body: "Headline + subtitle templates, curated fonts, solid/gradient/image backgrounds, and presets you can reuse.",
  },
  {
    title: "AI review & copy",
    body: "Multilingual headlines (incl. Spanish), background suggestions, auto layout pick, and a scorecard with one-click fixes.",
  },
];

const STEPS = [
  ["Upload", "Drop your raw simulator or device screenshots and drag to reorder."],
  ["Devices", "Pick single, dual, tilted, or foldable layouts and your export targets."],
  ["Style", "Captions, fonts, templates, backgrounds — preview live at real size."],
  ["AI review", "Optional: get copy in 8 languages and a scorecard with fixes."],
  ["Export", "Batch-export every size as a ZIP, foldered by platform."],
];

const FAQ = [
  [
    "Do I need an account?",
    "No. The editor works anonymously and everything renders in your browser. Sign in for AI actions, and upgrade to remove the watermark and sync presets.",
  ],
  [
    "Are my screenshots uploaded?",
    "No. Composition happens client-side on a canvas. Only AI features send a downscaled preview to the server, and only when you click them.",
  ],
  [
    "Will App Store Connect accept the files?",
    "Exports match Apple's published screenshot specifications exactly and are encoded without an alpha channel.",
  ],
  [
    "What's the difference between Pro and Lifetime?",
    "Both remove the watermark and unlock cloud presets. Pro includes 150 AI actions/month and early access; Lifetime is a one-time payment with 50 AI actions/month.",
  ],
  [
    "Can I get a refund?",
    "Yes — 7-day money-back guarantee on any purchase. See the refund policy.",
  ],
];

export default function LandingPage() {
  const url = appUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    url,
    description: SITE_DESCRIPTION,
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
      { "@type": "Offer", name: "Pro Monthly", price: "9", priceCurrency: "USD" },
      { "@type": "Offer", name: "Pro Yearly", price: "79", priceCurrency: "USD" },
      { "@type": "Offer", name: "Lifetime", price: "39", priceCurrency: "USD" },
    ],
  };

  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <section className="relative overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] px-6 py-14 sm:px-12 sm:py-20">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 100% 0%, rgba(15,118,110,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 0% 100%, rgba(20,184,166,0.12), transparent 50%)",
          }}
        />
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            For iOS & macOS developers
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-[1.05] tracking-tight text-[var(--ink)] sm:text-6xl">
            App Store screenshots that pass review the first time.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[var(--ink-soft)]">
            Design framed, captioned screenshots once and export every App Store Connect size —
            right in your browser. No design tool, no upload.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/studio"
              className="inline-flex min-h-[52px] items-center rounded-full bg-[var(--accent)] px-7 text-[15px] font-medium text-white"
            >
              Open the editor — free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-[52px] items-center rounded-full border border-[var(--line)] bg-white px-7 text-[15px] font-medium text-[var(--ink)]"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Looking for the tool you bookmarked? It now lives at{" "}
            <Link href="/studio" className="underline">/studio</Link>.
          </p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Everything App Store Connect asks for
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5"
            >
              <h3 className="font-semibold text-[var(--ink)]">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-5">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5">
              <span className="font-[family-name:var(--font-jetbrains)] text-xs text-[var(--accent)]">
                0{i + 1}
              </span>
              <h3 className="mt-1 font-semibold text-[var(--ink)]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
            Simple pricing
          </h2>
          <Link href="/pricing" className="text-sm text-[var(--accent)] underline">
            Compare plans
          </Link>
        </div>
        <div className="mt-6">
          <PricingCards compact />
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">FAQ</h2>
        <div className="mt-6 divide-y divide-[var(--line)] rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)]">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group p-5">
              <summary className="cursor-pointer list-none font-medium text-[var(--ink)]">
                {q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-[2rem] bg-[var(--ink)] px-6 py-12 text-center sm:px-12">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-white">
          Ship your next release with better screenshots.
        </h2>
        <Link
          href="/studio"
          className="mt-6 inline-flex min-h-[52px] items-center rounded-full bg-[var(--accent-soft)] px-7 text-[15px] font-medium text-[var(--ink)]"
        >
          Open the editor
        </Link>
      </section>
    </main>
  );
}
