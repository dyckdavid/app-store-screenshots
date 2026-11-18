/**
 * Seed a FRESH preview/dev database with catalog rows + fake data only.
 * Never copies production rows. Idempotent (upserts / on-conflict-do-nothing).
 *
 *   DATABASE_URL_UNPOOLED=... npm run db:seed
 */
import { sql } from "drizzle-orm";
import { CATALOG } from "../src/lib/billing/catalog";
import { vercelBlobPrivateStorage } from "../src/lib/storage";
import { refuseProduction, scriptDb } from "./_db";

refuseProduction("db:seed");

/** Smallest valid one-page PDF, generated inline (fake test asset). */
function tinyPdf(): Uint8Array {
  const body = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
    "4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 20 50 Td (Sample plan) Tj ET\nendstream endobj",
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    "trailer<</Root 1 0 R>>",
    "%%EOF",
  ].join("\n");
  return new TextEncoder().encode(body);
}

async function main() {
  const { db, pool, schema } = scriptDb();

  for (const product of CATALOG) {
    await db
      .insert(schema.products)
      .values({ key: product.key, kind: product.kind, name: product.name })
      .onConflictDoUpdate({
        target: schema.products.key,
        set: { kind: product.kind, name: product.name },
      });
    for (const price of product.prices) {
      await db
        .insert(schema.prices)
        .values({
          productKey: product.key,
          priceKey: price.priceKey,
          interval: price.interval,
          currency: price.currency,
          unitAmount: price.unitAmount,
        })
        .onConflictDoUpdate({
          target: schema.prices.priceKey,
          set: { unitAmount: price.unitAmount, interval: price.interval },
        });
    }
  }

  // Fake users (ids are obviously synthetic; no real accounts).
  await db
    .insert(schema.entitlements)
    .values({
      userId: "seed-user-pro",
      entitlementKey: "asc_pro",
      source: "admin",
      status: "active",
      productKey: "asc_pro",
      stripePaymentIntent: "seed_pi_admin_pro",
    })
    .onConflictDoNothing();

  const pdf = tinyPdf();
  const storageKey = "digital/sample_plan_pdf/v1/sample-plan.pdf";
  if (vercelBlobPrivateStorage.isConfigured()) {
    await vercelBlobPrivateStorage.put(storageKey, pdf, "application/pdf");
    console.log("Uploaded fake sample PDF to private storage.");
  } else {
    console.log("BLOB_READ_WRITE_TOKEN not set: registering asset row only.");
  }
  const existing = await db.execute(
    sql`select id from digital_assets where storage_key = ${storageKey} limit 1`,
  );
  if (existing.rows.length === 0) {
    await db.insert(schema.digitalAssets).values({
      productKey: "sample_plan_pdf",
      filename: "sample-plan.pdf",
      storageKey,
      sizeBytes: pdf.byteLength,
      version: 1,
    });
  }

  console.log("Seed complete.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
