"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthChanged } from "@/lib/auth/session-client";
import { getPlanLimits, type Plan, type PlanLimits } from "./plans";

export interface MeResponse {
  signedIn: boolean;
  user: { email: string | null; name: string | null } | null;
  authConfigured: boolean;
  /** Stripe checkout available on this deployment. */
  billingEnabled: boolean;
  plan: Plan;
  limits: PlanLimits;
  usage: { aiUsed: number; aiLimit: number; aiCredits: number; period: "day" | "month" } | null;
  pastDue: boolean;
}

const ANON: MeResponse = {
  signedIn: false,
  user: null,
  authConfigured: false,
  billingEnabled: false,
  plan: "free",
  limits: getPlanLimits("free"),
  usage: null,
  pastDue: false,
};

let inflight: Promise<MeResponse> | null = null;
let cachedMe: MeResponse | null = null;
let fetchedAt = 0;
/** Re-check plan/session when a tab regains focus after this long. */
const STALE_MS = 30_000;
const listeners = new Set<(me: MeResponse) => void>();

async function fetchMe(): Promise<MeResponse> {
  try {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (!res.ok) return ANON;
    return (await res.json()) as MeResponse;
  } catch {
    return ANON;
  }
}

export function refreshEntitlements(): Promise<MeResponse> {
  if (inflight) return inflight;
  inflight = fetchMe().then((me) => {
    cachedMe = me;
    fetchedAt = Date.now();
    inflight = null;
    for (const l of listeners) l(me);
    return me;
  });
  return inflight;
}

/** Plan/limits/usage for the current visitor (anonymous = free). */
export function useEntitlements(): {
  data: MeResponse | null;
  loading: boolean;
  refresh: () => Promise<MeResponse>;
} {
  const [data, setData] = useState<MeResponse | null>(cachedMe);

  useEffect(() => {
    listeners.add(setData);
    if (!cachedMe && !inflight) void refreshEntitlements();
    else if (inflight) void inflight.then(setData);
    const onFocus = () => {
      if (document.visibilityState === "visible" && Date.now() - fetchedAt > STALE_MS) {
        void refreshEntitlements();
      }
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    // Signed in/out in another tab → refresh here too.
    const off = onAuthChanged(() => void refreshEntitlements());
    return () => {
      listeners.delete(setData);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      off();
    };
  }, []);

  const refresh = useCallback(() => refreshEntitlements(), []);
  return { data, loading: data === null, refresh };
}
