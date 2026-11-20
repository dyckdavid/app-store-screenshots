import * as repo from "@/lib/billing/repo";
import { requireCloudPresets } from "../_guard";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = await requireCloudPresets();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  await repo.deletePresetRow(guard.user.id, id);
  return Response.json({ ok: true });
}
