/**
 * Admin CLI: upload a file to PRIVATE storage and register it for a product.
 *
 *   npm run asset:upload -- <product_key> <path/to/file> [--version 2]
 *
 * Example (future): sell an STL pack
 *   1. Add { key: "stl_pack_tractor", kind: "digital", ... } to src/lib/billing/catalog.ts
 *   2. npm run stripe:bootstrap
 *   3. npm run asset:upload -- stl_pack_tractor ./packs/tractor.zip
 */
import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import { findProduct } from "../src/lib/billing/catalog";
import { vercelBlobPrivateStorage } from "../src/lib/storage";
import { scriptDb } from "./_db";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".stl": "model/stl",
};

async function main() {
  const [productKey, filePath, ...rest] = process.argv.slice(2);
  if (!productKey || !filePath) {
    console.error("Usage: npm run asset:upload -- <product_key> <file> [--version N]");
    process.exit(1);
  }
  const product = findProduct(productKey);
  if (!product || product.kind !== "digital") {
    console.error(`Unknown digital product "${productKey}" (add it to catalog.ts first).`);
    process.exit(1);
  }
  if (!vercelBlobPrivateStorage.isConfigured()) {
    console.error("BLOB_READ_WRITE_TOKEN is required.");
    process.exit(1);
  }
  const vIdx = rest.indexOf("--version");
  const version = vIdx >= 0 ? Number(rest[vIdx + 1]) || 1 : 1;
  const filename = basename(filePath);
  const bytes = new Uint8Array(await readFile(filePath));
  const { size } = await stat(filePath);
  const storageKey = `digital/${productKey}/v${version}/${filename}`;
  const contentType = MIME[extname(filename).toLowerCase()] ?? "application/octet-stream";

  await vercelBlobPrivateStorage.put(storageKey, bytes, contentType);
  const { db, pool, schema } = scriptDb();
  const [row] = await db
    .insert(schema.digitalAssets)
    .values({ productKey, filename, storageKey, sizeBytes: size, version })
    .returning();
  console.log(`Registered asset #${row?.id} → ${storageKey}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
