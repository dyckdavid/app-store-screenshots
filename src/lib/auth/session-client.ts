"use client";
/**
 * Browser-side auth actions. Every auth change does a HARD navigation:
 * server components, the header, and cached plan data all re-render from a
 * clean slate, and other tabs are told via BroadcastChannel.
 */

const CHANNEL = "asc-auth";

export function notifyAuthChanged(): void {
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage({ type: "auth-changed", at: Date.now() });
    bc.close();
  } catch {
    // BroadcastChannel unsupported: other tabs refresh on focus instead
  }
}

export function onAuthChanged(cb: () => void): () => void {
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = () => cb();
  } catch {
    bc = null;
  }
  return () => bc?.close();
}

/** Same-origin path only; anything else falls back to `fallback`. */
export function safePath(next: string | null | undefined, fallback = "/studio"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export function hardNavigate(path: string): void {
  window.location.replace(new URL(safePath(path, "/"), window.location.origin).toString());
}

export async function signOut(opts: { everywhere?: boolean; to?: string } = {}): Promise<void> {
  try {
    await fetch("/api/account/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ everywhere: Boolean(opts.everywhere) }),
      cache: "no-store",
    });
  } finally {
    notifyAuthChanged();
    hardNavigate(opts.to ?? "/");
  }
}
