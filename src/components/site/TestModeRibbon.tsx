import { stripeMode } from "@/lib/billing/stripe-mode";

/** Visible whenever Stripe runs with an sk_test_ key. */
export default function TestModeRibbon() {
  if (stripeMode() !== "test") return null;
  return (
    <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
      Test mode — payments use Stripe test cards only (e.g. 4242 4242 4242 4242). No real charges.
    </div>
  );
}
