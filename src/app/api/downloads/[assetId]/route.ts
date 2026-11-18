import { createHash } from "node:crypto";
import { requireUser } from "@/lib/auth/server";
import { isDbConfigured } from "@/db/client";
import { findProduct } from "@/lib/billing/catalog";
import { hasEntitlement } from "@/lib/billing/entitlements";
import * as repo from "@/lib/billing/repo";
import { clientIpFromRequest } from "@/lib/ai/rate-limit";
import { getStorage, StorageNotConfiguredError } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashIp(ip: string): string | null {
  if (!ip || ip === "unknown") return null;
  const salt = process.env.NEON_AUTH_COOKIE_SECRET ?? "asc-studio";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Streams a private asset after checking auth + entitlement. The browser
 * never sees a storage URL, so there's no permanent public link to share.
 */
export async function GET(request: Request, ctx: { params: Promise<{ assetId: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  if (!isDbConfigured()) return Response.json({ error: "Not configured" }, { status: 503 });

  const { assetId } = await ctx.params;
  const id = Number.parseInt(assetId, 10);
  if (!Number.isFinite(id) || id <= 0) return Response.json({ error: "Not found" }, { status: 404 });

  const asset = await repo.getAsset(id);
  const product = asset ? findProduct(asset.productKey) : null;
  if (!asset || !product) return Response.json({ error: "Not found" }, { status: 404 });

  if (!(await hasEntitlement(auth.user.id, product.grants))) {
    return Response.json({ error: "You don't own this product.", code: "not_entitled" }, { status: 403 });
  }

  try {
    const obj = await getStorage().get(asset.storageKey);
    if (!obj) return Response.json({ error: "File missing" }, { status: 404 });
    await repo.recordDownload(auth.user.id, asset.id, hashIp(clientIpFromRequest(request)));
    const safeName = asset.filename.replace(/[^\w.\-]+/g, "_");
    return new Response(obj.stream, {
      headers: {
        "Content-Type": obj.contentType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(obj.size ? { "Content-Length": String(obj.size) } : {}),
      },
    });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    console.error("[download]", err);
    return Response.json({ error: "Download failed" }, { status: 502 });
  }
}
