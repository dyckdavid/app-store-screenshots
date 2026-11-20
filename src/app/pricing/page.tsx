import type { Metadata } from "next";
import PricingCards from "@/components/site/PricingCards";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "ASC Studio is free to start. Pro ($9/mo or $79/yr) removes the watermark and adds cloud presets and 150 AI actions a month. Lifetime is $39 once.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)] sm:text-5xl">
          Pricing
        </h1>
        <p className="mt-3 text-[16px] text-[var(--muted)]">
          Every size and layout is free. Upgrade to drop the watermark, sync presets, and get more AI.
        </p>
      </div>
      <div className="mt-10">
        <PricingCards />
      </div>
    </main>
  );
}
