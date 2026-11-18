import type { Metadata } from "next";
import LegalPage from "@/components/site/LegalPage";

export const metadata: Metadata = {
  title: "Refund Policy",
  alternates: { canonical: "/refund" },
};

export default function RefundPage() {
  return (
    <LegalPage title="Refund Policy" updated="2026-11-18">
      <h2>7-day money-back guarantee</h2>
      <p>
        If ASC Studio isn&apos;t right for you, contact support within 7 days of a purchase or a
        subscription&apos;s first charge for a full refund — no questions asked.
      </p>
      <ul>
        <li>Refunded lifetime and digital purchases lose access to the related features or files.</li>
        <li>Cancelling a subscription stops future renewals; access continues until the end of the paid period.</li>
        <li>Prices are in USD; your bank may apply currency conversion. Taxes may apply.</li>
      </ul>
    </LegalPage>
  );
}
