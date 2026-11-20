/**
 * Single source of truth for sellable products and prices (Stripe TEST MODE).
 *
 * `scripts/stripe-bootstrap.ts` creates matching Stripe Products/Prices,
 * matched by `metadata.catalog_key`, and upserts the `products`/`prices` rows.
 *
 * To sell something new (e.g. STL packs, equipment-plan PDFs): add a
 * `digital` product + price here, run `npm run stripe:bootstrap`, then
 * register the file with `npm run asset:upload -- <product_key> <file>`.
 */

export type ProductKind = "subscription" | "lifetime" | "credits" | "digital";
export type PriceInterval = "month" | "year" | null;

export interface CatalogPrice {
  priceKey: string;
  unitAmount: number; // cents
  currency: "usd";
  interval: PriceInterval;
  nickname: string;
}

export interface CatalogProduct {
  key: string;
  kind: ProductKind;
  name: string;
  description: string;
  /** Entitlement key granted on purchase / active subscription. */
  grants: string;
  /** Credits added for kind=credits. */
  credits?: number;
  /** Hidden from checkout unless enabled (feature flag). */
  flag?: "AI_PACKS_ENABLED";
  prices: CatalogPrice[];
}

export const ENTITLEMENT_PRO = "asc_pro";

export const CATALOG: CatalogProduct[] = [
  {
    key: "asc_pro",
    kind: "subscription",
    name: "ASC Studio Pro",
    description: "No watermark, cloud presets, 150 AI actions/month.",
    grants: ENTITLEMENT_PRO,
    prices: [
      {
        priceKey: "asc_pro_monthly",
        unitAmount: 900,
        currency: "usd",
        interval: "month",
        nickname: "Pro Monthly",
      },
      {
        priceKey: "asc_pro_yearly",
        unitAmount: 7900,
        currency: "usd",
        interval: "year",
        nickname: "Pro Yearly",
      },
    ],
  },
  {
    key: "asc_pro_lifetime",
    kind: "lifetime",
    name: "ASC Studio Lifetime",
    description: "No watermark + cloud presets forever, 50 AI actions/month.",
    grants: ENTITLEMENT_PRO,
    prices: [
      {
        priceKey: "asc_pro_lifetime",
        unitAmount: 3900,
        currency: "usd",
        interval: null,
        nickname: "Lifetime",
      },
    ],
  },
  {
    key: "asc_ai_pack_50",
    kind: "credits",
    name: "AI pack (50 actions)",
    description: "Adds 50 AI actions to your account.",
    grants: "asc_ai_credits",
    credits: 50,
    flag: "AI_PACKS_ENABLED",
    prices: [
      {
        priceKey: "asc_ai_pack_50",
        unitAmount: 500,
        currency: "usd",
        interval: null,
        nickname: "AI pack 50",
      },
    ],
  },
  {
    key: "sample_plan_pdf",
    kind: "digital",
    name: "Sample plan PDF (test product)",
    description: "Test-only digital product proving the generic store path.",
    grants: "sample_plan_pdf",
    prices: [
      {
        priceKey: "sample_plan_pdf",
        unitAmount: 500,
        currency: "usd",
        interval: null,
        nickname: "Sample plan PDF",
      },
    ],
  },
];

export function findPrice(
  priceKey: string,
): { product: CatalogProduct; price: CatalogPrice } | null {
  for (const product of CATALOG) {
    const price = product.prices.find((p) => p.priceKey === priceKey);
    if (price) return { product, price };
  }
  return null;
}

export function findProduct(key: string): CatalogProduct | null {
  return CATALOG.find((p) => p.key === key) ?? null;
}

export function isPriceAvailable(priceKey: string): boolean {
  const hit = findPrice(priceKey);
  if (!hit) return false;
  if (hit.product.flag && process.env[hit.product.flag] !== "true") return false;
  return true;
}
