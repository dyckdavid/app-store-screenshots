/**
 * Drizzle schema for ASC Studio monetization.
 *
 * `user_id` columns are `text` and hold the Neon Auth (Better Auth) user id.
 * Neon Auth manages its own `neon_auth.*` tables; we never write to them and
 * deliberately do not add a foreign key across schemas so migrations stay
 * safe on a fresh branch where Neon Auth may not be enabled yet.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const productKind = pgEnum("product_kind", [
  "subscription",
  "lifetime",
  "credits",
  "digital",
]);
export const entitlementSource = pgEnum("entitlement_source", [
  "subscription",
  "purchase",
  "admin",
]);
export const entitlementStatus = pgEnum("entitlement_status", [
  "active",
  "past_due",
  "canceled",
  "revoked",
]);
export const purchaseStatus = pgEnum("purchase_status", ["paid", "refunded"]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const customers = pgTable("customers", {
  userId: text("user_id").primaryKey(),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  createdAt: createdAt(),
});

export const products = pgTable("products", {
  key: text("key").primaryKey(),
  kind: productKind("kind").notNull(),
  name: text("name").notNull(),
  stripeProductId: text("stripe_product_id").unique(),
  active: boolean("active").notNull().default(true),
});

export const prices = pgTable("prices", {
  id: serial("id").primaryKey(),
  productKey: text("product_key")
    .notNull()
    .references(() => products.key),
  priceKey: text("price_key").notNull().unique(),
  stripePriceId: text("stripe_price_id").unique(),
  /** null for one-time prices */
  interval: text("interval"),
  currency: text("currency").notNull(),
  unitAmount: integer("unit_amount").notNull(),
  active: boolean("active").notNull().default(true),
});

export const entitlements = pgTable(
  "entitlements",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    entitlementKey: text("entitlement_key").notNull(),
    source: entitlementSource("source").notNull(),
    status: entitlementStatus("status").notNull(),
    /** null = never expires (lifetime / digital) */
    validUntil: timestamp("valid_until", { withTimezone: true }),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePaymentIntent: text("stripe_payment_intent"),
    /** Which catalog product granted this (e.g. asc_pro_lifetime). */
    productKey: text("product_key"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("entitlements_user_idx").on(t.userId),
    uniqueIndex("entitlements_subscription_uq").on(
      t.stripeSubscriptionId,
      t.entitlementKey,
    ),
    uniqueIndex("entitlements_payment_intent_uq").on(
      t.stripePaymentIntent,
      t.entitlementKey,
    ),
  ],
);

export const purchases = pgTable(
  "purchases",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    productKey: text("product_key").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id")
      .notNull()
      .unique(),
    stripePaymentIntent: text("stripe_payment_intent"),
    amountTotal: integer("amount_total").notNull(),
    currency: text("currency").notNull(),
    status: purchaseStatus("status").notNull().default("paid"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("purchases_user_idx").on(t.userId),
    index("purchases_payment_intent_idx").on(t.stripePaymentIntent),
  ],
);

export const digitalAssets = pgTable("digital_assets", {
  id: serial("id").primaryKey(),
  productKey: text("product_key")
    .notNull()
    .references(() => products.key),
  filename: text("filename").notNull(),
  storageKey: text("storage_key").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: createdAt(),
});

export const downloadEvents = pgTable(
  "download_events",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => digitalAssets.id),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [index("download_events_user_idx").on(t.userId, t.createdAt)],
);

/**
 * AI usage ledger. Positive `units` = consumption; negative `units` with
 * kind `credit` = purchased credit packs (asc_ai_pack_50).
 */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull(),
    units: integer("units").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [index("usage_events_user_created_idx").on(t.userId, t.createdAt)],
);

export const presets = pgTable(
  "presets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    data: jsonb("data").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [index("presets_user_idx").on(t.userId)],
);

export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  payload: jsonb("payload"),
});
