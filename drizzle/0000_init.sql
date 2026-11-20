CREATE TYPE "public"."entitlement_source" AS ENUM('subscription', 'purchase', 'admin');--> statement-breakpoint
CREATE TYPE "public"."entitlement_status" AS ENUM('active', 'past_due', 'canceled', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."product_kind" AS ENUM('subscription', 'lifetime', 'credits', 'digital');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('paid', 'refunded');--> statement-breakpoint
CREATE TABLE "customers" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "digital_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_key" text NOT NULL,
	"filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "download_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"asset_id" integer NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"entitlement_key" text NOT NULL,
	"source" "entitlement_source" NOT NULL,
	"status" "entitlement_status" NOT NULL,
	"valid_until" timestamp with time zone,
	"stripe_subscription_id" text,
	"stripe_payment_intent" text,
	"product_key" text,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_key" text NOT NULL,
	"price_key" text NOT NULL,
	"stripe_price_id" text,
	"interval" text,
	"currency" text NOT NULL,
	"unit_amount" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "prices_price_key_unique" UNIQUE("price_key"),
	CONSTRAINT "prices_stripe_price_id_unique" UNIQUE("stripe_price_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"key" text PRIMARY KEY NOT NULL,
	"kind" "product_kind" NOT NULL,
	"name" text NOT NULL,
	"stripe_product_id" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "products_stripe_product_id_unique" UNIQUE("stripe_product_id")
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_key" text NOT NULL,
	"stripe_checkout_session_id" text NOT NULL,
	"stripe_payment_intent" text,
	"amount_total" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "purchase_status" DEFAULT 'paid' NOT NULL,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"units" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "digital_assets" ADD CONSTRAINT "digital_assets_product_key_products_key_fk" FOREIGN KEY ("product_key") REFERENCES "public"."products"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_asset_id_digital_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."digital_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_product_key_products_key_fk" FOREIGN KEY ("product_key") REFERENCES "public"."products"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "download_events_user_idx" ON "download_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "entitlements_user_idx" ON "entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlements_subscription_uq" ON "entitlements" USING btree ("stripe_subscription_id","entitlement_key");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlements_payment_intent_uq" ON "entitlements" USING btree ("stripe_payment_intent","entitlement_key");--> statement-breakpoint
CREATE INDEX "presets_user_idx" ON "presets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "purchases_user_idx" ON "purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "purchases_payment_intent_idx" ON "purchases" USING btree ("stripe_payment_intent");--> statement-breakpoint
CREATE INDEX "usage_events_user_created_idx" ON "usage_events" USING btree ("user_id","created_at");