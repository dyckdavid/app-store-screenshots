import type { Metadata } from "next";
import LegalPage from "@/components/site/LegalPage";
import { APPLE_DISCLAIMER } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="2026-11-18">
      <p>
        These terms govern your use of ASC Studio (the &quot;Service&quot;). By using the Service you agree to them.
        This is placeholder text and will be replaced after legal review.
      </p>
      <h2>The Service</h2>
      <p>
        ASC Studio is a browser-based tool for composing App Store marketing screenshots. Image
        composition runs in your browser; AI features send downscaled previews to our servers only
        when you invoke them.
      </p>
      <h2>Accounts</h2>
      <p>You are responsible for activity on your account and for keeping your sign-in email secure.</p>
      <h2>Paid plans</h2>
      <ul>
        <li>Subscriptions renew automatically until cancelled from your account&apos;s billing portal.</li>
        <li>Lifetime purchases grant the listed features for the life of the Service, with AI usage subject to fair-use limits.</li>
        <li>Refunds follow our <a className="underline" href="/refund">refund policy</a>.</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>Don&apos;t abuse AI features, attempt to bypass limits, or use the Service for unlawful content.</p>
      <h2>Your content</h2>
      <p>You keep all rights to screenshots and text you create. You are responsible for having the rights to what you upload.</p>
      <h2>Trademarks</h2>
      <p>{APPLE_DISCLAIMER} Device frames are provided by third parties under their own terms (see NOTICE).</p>
      <h2>Disclaimers</h2>
      <p>The Service is provided &quot;as is&quot;. We don&apos;t guarantee App Store approval of any asset.</p>
    </LegalPage>
  );
}
