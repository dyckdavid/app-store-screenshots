"use client";

import { useCallback, useEffect, useState } from "react";
import { getPlanLimits, type Plan, type PlanLimits } from "./plans";

export interface MeResponse {
  signedIn: boolean;
  authConfigured: boolean;
  plan: Plan;
  limits: PlanLimits;
  usage: { aiUsed: number; aiLimit: number; aiCredits: number; period: "day" | "month" } | null;
  pastDue: boolean;
}

const ANON: MeResponse = {
  signedIn: false,
  authConfigured: false,
  plan: "free",
  limits: getPlanLimits("free"),
  usage: null,
  pastDue: false,
};

let inflight: Promise<MeResponse> | null = null;
let cachedMe: MeResponse | null = null;
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
  inflight = fetchMe().then((me) => {
    cachedMe = me;
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
    return () => {
      listeners.delete(setData);
    };
  }, []);

  const refresh = useCallback(() => refreshEntitlements(), []);
  return { data, loading: data === null, refresh };
}
