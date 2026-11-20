/** Shared DB bootstrap for CLI scripts (no `server-only`, direct connection). */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "../src/db/schema";

export function scriptDb() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL_UNPOOLED (or DATABASE_URL) is required.");
    process.exit(1);
  }
  if (typeof WebSocket !== "undefined") {
    neonConfig.webSocketConstructor = WebSocket;
  }
  const pool = new Pool({ connectionString: url });
  return { db: drizzle({ client: pool, schema }), pool, schema };
}

export function refuseProduction(scriptName: string) {
  if (
    process.env.VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" &&
      process.env.ALLOW_SCRIPT_IN_PRODUCTION !== "true")
  ) {
    console.error(
      `${scriptName}: refusing to run against a production environment.`,
    );
    process.exit(1);
  }
}
