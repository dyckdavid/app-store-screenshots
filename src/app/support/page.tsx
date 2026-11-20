import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with ASC Studio exports, accounts, and billing.",
  alternates: { canonical: "/support" },
};

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export default function SupportPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">Support</h1>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-[var(--ink-soft)]">
        <p>
          Questions about exports, your account, or billing?{" "}
          {SUPPORT_EMAIL ? (
            <>Email <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</>
          ) : (
            <>Open an issue on the project&apos;s GitHub repository.</>
          )}
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Manage or cancel a subscription from <Link className="underline" href="/account">your account</Link> → Manage billing.</li>
          <li>Refunds: see the <Link className="underline" href="/refund">refund policy</Link> (7-day money-back).</li>
          <li>Exports are opaque RGB PNGs at Apple&apos;s exact pixel sizes; if App Store Connect rejects one, tell us the size.</li>
        </ul>
      </div>
    </main>
  );
}
