import "server-only";
/**
 * Data-access boundary for billing/entitlements/usage. Tests mock this
 * module; everything above it is DB-agnostic.
 */
import { and, desc, eq, gte, like, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  customers,
  digitalAssets,
  downloadEvents,
  entitlements,
  presets,
  purchases,
  usageEvents,
} from "@/db/schema";
import type { EntitlementRow } from "./entitlement-rules";

export async function listEntitlements(userId: string): Promise<EntitlementRow[]> {
  const rows = await getDb()
    .select()
    .from(entitlements)
    .where(eq(entitlements.userId, userId));
  return rows.map((r) => ({
    entitlementKey: r.entitlementKey,
    source: r.source,
    status: r.status,
    validUntil: r.validUntil,
    productKey: r.productKey,
    cancelAtPeriodEnd: r.cancelAtPeriodEnd,
  }));
}

export async function listEntitlementDetails(userId: string) {
  return getDb()
    .select()
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .orderBy(desc(entitlements.updatedAt));
}

// ---- usage / quota -------------------------------------------------------

/** AI actions drawn from the plan allowance since `since`. */
export async function countAllowanceUsage(userId: string, since: Date): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`coalesce(sum(${usageEvents.units}), 0)::int` })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, userId),
        like(usageEvents.kind, "ai:%"),
        gte(usageEvents.createdAt, since),
      ),
    );
  return row?.n ?? 0;
}

/** Purchased credits minus credits spent (all time). Unclamped: may be <0 after a race. */
export async function creditBalance(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({
      granted: sql<number>`coalesce(sum(case when ${usageEvents.kind} = 'credit' then ${usageEvents.units} else 0 end), 0)::int`,
      spent: sql<number>`coalesce(sum(case when ${usageEvents.kind} like 'ai_credit:%' then ${usageEvents.units} else 0 end), 0)::int`,
    })
    .from(usageEvents)
    .where(eq(usageEvents.userId, userId));
  return (row?.granted ?? 0) - (row?.spent ?? 0);
}

export async function insertUsage(userId: string, kind: string, units = 1): Promise<number> {
  const [row] = await getDb()
    .insert(usageEvents)
    .values({ userId, kind, units })
    .returning({ id: usageEvents.id });
  return row!.id;
}

export async function deleteUsage(id: number): Promise<void> {
  await getDb().delete(usageEvents).where(eq(usageEvents.id, id));
}

// ---- customers / purchases ------------------------------------------------

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const [row] = await getDb()
    .select()
    .from(customers)
    .where(eq(customers.userId, userId))
    .limit(1);
  return row?.stripeCustomerId ?? null;
}

export async function saveStripeCustomerId(userId: string, stripeCustomerId: string) {
  await getDb()
    .insert(customers)
    .values({ userId, stripeCustomerId })
    .onConflictDoUpdate({ target: customers.userId, set: { stripeCustomerId } });
}

export async function listPurchases(userId: string) {
  return getDb()
    .select()
    .from(purchases)
    .where(eq(purchases.userId, userId))
    .orderBy(desc(purchases.createdAt));
}

// ---- digital assets -------------------------------------------------------

export async function getAsset(assetId: number) {
  const [row] = await getDb()
    .select()
    .from(digitalAssets)
    .where(eq(digitalAssets.id, assetId))
    .limit(1);
  return row ?? null;
}

export async function listAssetsForProducts(productKeys: string[]) {
  if (productKeys.length === 0) return [];
  return getDb()
    .select()
    .from(digitalAssets)
    .where(sql`${digitalAssets.productKey} in ${productKeys}`)
    .orderBy(digitalAssets.productKey, desc(digitalAssets.version));
}

export async function recordDownload(userId: string, assetId: number, ipHash: string | null) {
  await getDb().insert(downloadEvents).values({ userId, assetId, ipHash });
}

// ---- presets ---------------------------------------------------------------

export async function listPresets(userId: string) {
  return getDb()
    .select()
    .from(presets)
    .where(eq(presets.userId, userId))
    .orderBy(desc(presets.updatedAt));
}

export async function upsertPreset(userId: string, id: string, name: string, data: unknown) {
  const [row] = await getDb()
    .insert(presets)
    .values({ id, userId, name, data })
    .onConflictDoUpdate({
      target: presets.id,
      set: { name, data, updatedAt: new Date() },
      setWhere: eq(presets.userId, userId),
    })
    .returning();
  return row ?? null;
}

export async function deletePresetRow(userId: string, id: string) {
  await getDb()
    .delete(presets)
    .where(and(eq(presets.id, id), eq(presets.userId, userId)));
}

export async function countPresets(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(presets)
    .where(eq(presets.userId, userId));
  return row?.n ?? 0;
}
