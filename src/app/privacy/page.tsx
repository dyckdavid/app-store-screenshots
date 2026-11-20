import type { Metadata } from "next";
import LegalPage from "@/components/site/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="2026-11-18">
      <p>Placeholder privacy policy pending legal review.</p>
      <h2>What stays on your device</h2>
      <p>Your screenshots are composed and exported in your browser. Local presets live in your browser&apos;s storage.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account: your email address and sign-in provider (via Neon Auth).</li>
        <li>Billing: handled by Stripe. We store your Stripe customer ID and purchase records, never card numbers.</li>
        <li>Usage: counts of AI actions for quota enforcement; cloud presets if you choose to sync them.</li>
        <li>Analytics: aggregate, cookieless page and event analytics (Vercel Web Analytics), with no personal data in events.</li>
        <li>AI: when you use an AI feature, a downscaled preview and your caption text are sent to our AI provider to generate a response.</li>
      </ul>
      <h2>Your choices</h2>
      <p>You can delete cloud presets at any time and request account deletion via the support page.</p>
    </LegalPage>
  );
}
