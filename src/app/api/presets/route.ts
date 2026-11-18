import { z } from "zod";
import * as repo from "@/lib/billing/repo";
import { MAX_PRESETS, MAX_PRESET_BYTES, requireCloudPresets } from "./_guard";

export const dynamic = "force-dynamic";

const PresetInput = z.object({
  id: z.string().min(1).max(100).regex(/^[A-Za-z0-9._-]+$/),
  name: z.string().trim().min(1).max(120),
  design: z.record(z.string(), z.unknown()),
});

export async function GET() {
  const guard = await requireCloudPresets();
  if (!guard.ok) return guard.response;
  const rows = await repo.listPresets(guard.user.id);
  return Response.json({
    presets: rows.map((r) => ({
      id: r.id,
      name: r.name,
      design: r.data,
      savedAt: r.updatedAt.getTime(),
    })),
  });
}

/** Upsert one preset (POST { id, name, design }). */
export async function POST(request: Request) {
  const guard = await requireCloudPresets();
  if (!guard.ok) return guard.response;

  const raw = await request.text();
  if (raw.length > MAX_PRESET_BYTES) {
    return Response.json({ error: "Preset too large." }, { status: 413 });
  }
  let parsed: z.infer<typeof PresetInput>;
  try {
    parsed = PresetInput.parse(JSON.parse(raw));
  } catch {
    return Response.json({ error: "Invalid preset." }, { status: 400 });
  }
  const count = await repo.countPresets(guard.user.id);
  if (count >= MAX_PRESETS) {
    const existing = (await repo.listPresets(guard.user.id)).some((p) => p.id === parsed.id);
    if (!existing) {
      return Response.json({ error: `Limit of ${MAX_PRESETS} cloud presets.` }, { status: 409 });
    }
  }
  const row = await repo.upsertPreset(guard.user.id, parsed.id, parsed.name, parsed.design);
  if (!row) {
    // id exists but belongs to another user
    return Response.json({ error: "Preset id conflict." }, { status: 409 });
  }
  return Response.json({ ok: true, id: row.id });
}
