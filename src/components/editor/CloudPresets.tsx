"use client";

import { useCallback, useEffect, useState } from "react";
import type { SavedPreset } from "@/lib/presets";
import { useEntitlements } from "@/lib/billing/use-entitlements";
import { openPaywall } from "./PaywallModal";

/**
 * Minimal Pro cloud sync: push local presets up, pull cloud presets down.
 * localStorage presets keep working for everyone regardless.
 */
export default function CloudPresets({
  localPresets,
  onPulled,
}: {
  localPresets: SavedPreset[];
  onPulled: (presets: SavedPreset[]) => void;
}) {
  const { data } = useEntitlements();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const enabled = Boolean(data?.signedIn && data.limits.cloudPresets);

  const pull = useCallback(async () => {
    const res = await fetch("/api/presets", { cache: "no-store" });
    if (!res.ok) throw new Error(`Pull failed (${res.status})`);
    const json = (await res.json()) as { presets: SavedPreset[] };
    onPulled(json.presets);
    return json.presets.length;
  }, [onPulled]);

  useEffect(() => {
    if (enabled) void pull().catch(() => undefined);
  }, [enabled, pull]);

  async function sync() {
    if (!enabled) {
      openPaywall("cloud_presets");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      for (const p of localPresets) {
        const res = await fetch("/api/presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: p.id, name: p.name, design: p.design }),
        });
        if (!res.ok) throw new Error(`Sync failed (${res.status})`);
      }
      const n = await pull();
      setStatus(`Synced · ${n} preset${n === 1 ? "" : "s"} in your account`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void sync()}
        className="min-h-[40px] rounded-full border border-[var(--line)] bg-white px-4 text-sm font-medium text-[var(--ink)] disabled:opacity-50"
      >
        {busy ? "Syncing…" : enabled ? "Sync to cloud" : "Sync to cloud (Pro)"}
      </button>
      {status ? <span className="text-xs text-[var(--muted)]">{status}</span> : null}
    </div>
  );
}
