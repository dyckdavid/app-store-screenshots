import "server-only";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export type Db = NeonDatabase<typeof schema>;

let cached: Db | null = null;

export class DbNotConfiguredError extends Error {
  constructor() {
    super("Database not configured. Set DATABASE_URL.");
    this.name = "DbNotConfiguredError";
  }
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Lazy Drizzle client over the Neon serverless Pool (WebSocket), which
 * supports interactive transactions (needed by the Stripe webhook).
 * Never constructed at import time, so `next build` works without env.
 */
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new DbNotConfiguredError();
  if (typeof WebSocket !== "undefined" && !neonConfig.webSocketConstructor) {
    neonConfig.webSocketConstructor = WebSocket;
  }
  cached = drizzle({ client: new Pool({ connectionString: url }), schema });
  return cached;
}

export { schema };
