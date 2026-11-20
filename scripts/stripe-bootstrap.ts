/**
 * Idempotently create TEST-MODE Stripe Products/Prices from the catalog and
 * upsert the `products`/`prices` rows.
 *
 *   STRIPE_SECRET_KEY=sk_test_... DATABASE_URL_UNPOOLED=... npm run stripe:bootstrap
 *
 * Products are matched on metadata.catalog_key; prices on lookup_key (= price_key).
 * A price whose amount/interval changed gets a new Price and the lookup key is
 * transferred (Stripe prices are immutable). Refuses to run with a live key.
 */
import { pathToFileURL } from "node:url";
import Stripe from "stripe";
import { CATALOG, type CatalogProduct } from "../src/lib/billing/catalog";

const API_VERSION = "2026-10-28.endive" as const;

export function assertTestModeKey(key: string | undefined): string {
  if (!key) throw new Error("STRIPE_SECRET_KEY is required (sk_test_…).");
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) {
    throw new Error("Refusing to run stripe:bootstrap with a LIVE key. Test mode only.");
  }
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error("STRIPE_SECRET_KEY must be a test-mode key (sk_test_…).");
  }
  return key;
}

async function ensureProduct(stripe: Stripe, product: CatalogProduct): Promise<Stripe.Product> {
  for await (const p of stripe.products.list({ limit: 100 })) {
    if (p.metadata?.catalog_key === product.key) {
      if (p.name !== product.name || !p.active) {
        return stripe.products.update(p.id, { name: product.name, active: true });
      }
      return p;
    }
  }
  return stripe.products.create({
    name: product.name,
    description: product.description,
    metadata: { catalog_key: product.key, kind: product.kind },
  });
}

async function ensurePrice(
  stripe: Stripe,
  productId: string,
  price: CatalogProduct["prices"][number],
): Promise<Stripe.Price> {
  const existing = (await stripe.prices.list({ lookup_keys: [price.priceKey], limit: 1 })).data[0];
  const matches =
    existing &&
    existing.product === productId &&
    existing.unit_amount === price.unitAmount &&
    existing.currency === price.currency &&
    (existing.recurring?.interval ?? null) === price.interval;
  if (existing && matches) return existing;
  return stripe.prices.create({
    product: productId,
    unit_amount: price.unitAmount,
    currency: price.currency,
    nickname: price.nickname,
    lookup_key: price.priceKey,
    transfer_lookup_key: true,
    metadata: { catalog_key: price.priceKey },
    ...(price.interval ? { recurring: { interval: price.interval } } : {}),
  });
}

async function main() {
  const key = assertTestModeKey(process.env.STRIPE_SECRET_KEY);
  const stripe = new Stripe(key, { apiVersion: API_VERSION });
  const hasDb = Boolean(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
  const dbHandle = hasDb ? (await import("./_db")).scriptDb() : null;

  for (const product of CATALOG) {
    const sp = await ensureProduct(stripe, product);
    console.log(`product ${product.key} → ${sp.id}`);
    if (dbHandle) {
      const { db, schema } = dbHandle;
      await db
        .insert(schema.products)
        .values({ key: product.key, kind: product.kind, name: product.name, stripeProductId: sp.id })
        .onConflictDoUpdate({
          target: schema.products.key,
          set: { kind: product.kind, name: product.name, stripeProductId: sp.id, active: true },
        });
    }
    for (const price of product.prices) {
      const stripePrice = await ensurePrice(stripe, sp.id, price);
      console.log(`  price ${price.priceKey} → ${stripePrice.id}`);
      if (dbHandle) {
        const { db, schema } = dbHandle;
        await db
          .insert(schema.prices)
          .values({
            productKey: product.key,
            priceKey: price.priceKey,
            stripePriceId: stripePrice.id,
            interval: price.interval,
            currency: price.currency,
            unitAmount: price.unitAmount,
          })
          .onConflictDoUpdate({
            target: schema.prices.priceKey,
            set: {
              stripePriceId: stripePrice.id,
              interval: price.interval,
              unitAmount: price.unitAmount,
              active: true,
            },
          });
      }
    }
  }
  if (!dbHandle) console.log("No DATABASE_URL: Stripe only (checkout falls back to lookup keys).");
  await dbHandle?.pool.end();
  console.log("Bootstrap complete (test mode).");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
