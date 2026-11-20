import "server-only";
import * as repo from "./repo";
import {
  activeKeys,
  isPastDue,
  resolvePlan,
  type EntitlementRow,
} from "./entitlement-rules";
import { getPlanLimits, type Plan, type PlanLimits } from "./plans";

export async function getEntitlements(userId: string): Promise<EntitlementRow[]> {
  return repo.listEntitlements(userId);
}

export async function hasEntitlement(userId: string, key: string): Promise<boolean> {
  const rows = await getEntitlements(userId);
  return activeKeys(rows).has(key);
}

export async function getUserPlan(
  userId: string,
): Promise<{ plan: Plan; limits: PlanLimits; pastDue: boolean; rows: EntitlementRow[] }> {
  const rows = await getEntitlements(userId);
  const plan = resolvePlan(rows);
  return { plan, limits: getPlanLimits(plan), pastDue: isPastDue(rows), rows };
}

export { getPlanLimits };
