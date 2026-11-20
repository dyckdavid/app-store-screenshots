"use client";

import { useEffect, useState } from "react";
import { useEntitlements } from "@/lib/billing/use-entitlements";
import { normalizeStyle, type StudioStyle } from "@/lib/studio/model";
import { loadStylePresets, saveStylePresets, type StylePreset } from "@/lib/studio/project";
import { openPaywall } from "./PaywallModal";

/** Local style presets for everyone; cloud sync for Pro/Lifetime. */
export default function StylePresets({
  style,
  onApply,
}: {
  style: StudioStyle;
  onApply: (s: StudioStyle) => void;
}) {
  const { data } = useEntitlements();
  const cloud = Boolean(data?.signedIn && data.limits.cloudPresets);
  const [presets, setPresets] = useState<StylePreset[]>(() => loadStylePresets());
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!cloud) return;
    let alive = true;
    fetch("/api/presets", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { presets?: { id: string; name: string; design: unknown; savedAt: number }[] } | null) => {
        if (!alive || !json?.presets) return;
        setPresets((local) => {
          const byId = new Map(local.map((p) => [p.id, p]));
          for (const c of json.presets!) {
            byId.set(c.id, { id: c.id, name: c.name, savedAt: c.savedAt, style: normalizeStyle(c.design) });
          }
          const merged = [...byId.values()].sort((a, b) => b.savedAt - a.savedAt);
          saveStylePresets(merged);
          return merged;
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [cloud]);

  async function save() {
    const preset: StylePreset = {
      id: `style-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || `Style ${presets.length + 1}`,
      savedAt: Date.now(),
      style,
    };
    const next = [preset, ...presets];
    setPresets(next);
    saveStylePresets(next);
    setName("");
    if (cloud) {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: preset.id, name: preset.name, design: preset.style }),
      }).catch(() => null);
      setStatus(res?.ok ? "Saved to your account" : "Saved on this browser (cloud sync failed)");
    } else {
      setStatus("Saved on this browser");
    }
  }

  function remove(id: string) {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    saveStylePresets(next);
    if (cloud) void fetch(`/api/presets/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
  }

  return (
    <section className="space-y-2 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Saved styles</p>
        {!cloud ? (
          <button type="button" onClick={() => openPaywall("cloud_presets")} className="text-xs text-[var(--accent)] underline">
            Sync to cloud (Pro)
          </button>
        ) : (
          <span className="text-xs text-[var(--accent)]">Cloud sync on</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this style"
          className="min-h-[38px] min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white px-3 text-sm"
        />
        <button type="button" onClick={() => void save()} className="rounded-lg bg-[var(--accent)] px-3 text-sm font-medium text-white">
          Save
        </button>
      </div>
      {status ? <p className="text-xs text-[var(--muted)]">{status}</p> : null}
      {presets.length ? (
        <ul className="space-y-1">
          {presets.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)]/70 px-3 py-1.5 text-sm">
              <button type="button" onClick={() => onApply(p.style)} className="font-medium text-[var(--ink)]">
                {p.name}
              </button>
              <button type="button" onClick={() => remove(p.id)} className="text-xs text-[var(--muted)]">
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
