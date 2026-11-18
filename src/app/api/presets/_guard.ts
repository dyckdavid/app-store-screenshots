import "server-only";
import { requireUser, type SessionUser } from "@/lib/auth/server";
import { isDbConfigured } from "@/db/client";
import { getUserPlan } from "@/lib/billing/entitlements";

export async function requireCloudPresets(): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: Response }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!isDbConfigured()) {
    return {
      ok: false,
      response: Response.json(
        { error: "Cloud presets are not configured.", code: "db_not_configured" },
        { status: 503 },
      ),
    };
  }
  const { limits } = await getUserPlan(auth.user.id);
  if (!limits.cloudPresets) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "Cloud presets are a Pro feature.",
          code: "upgrade_required",
          upgradeUrl: "/pricing",
        },
        { status: 402 },
      ),
    };
  }
  return auth;
}

export const MAX_PRESETS = 100;
export const MAX_PRESET_BYTES = 2_000_000;
