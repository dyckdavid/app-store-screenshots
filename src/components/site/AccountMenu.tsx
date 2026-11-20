"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "@/lib/auth/session-client";
import type { MeResponse } from "@/lib/billing/use-entitlements";

const PLAN_LABEL = { free: "Free", pro: "Pro", lifetime: "Lifetime" } as const;

export default function AccountMenu({ me }: { me: MeResponse }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = me.user?.name || me.user?.email || "Account";
  const initial = (label.trim()[0] ?? "A").toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] py-1 pl-1 pr-3 text-sm text-[var(--ink)]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
          {initial}
        </span>
        <span className="whitespace-nowrap">{PLAN_LABEL[me.plan]}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-[var(--line)] bg-white text-sm shadow-xl"
        >
          <div className="border-b border-[var(--line)] px-4 py-3">
            <p className="truncate font-medium text-[var(--ink)]">{label}</p>
            {me.user?.name && me.user.email ? <p className="truncate text-xs text-[var(--muted)]">{me.user.email}</p> : null}
            {me.usage ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                AI: {me.usage.aiUsed}/{me.usage.aiLimit} this {me.usage.period}
              </p>
            ) : null}
          </div>
          <Link role="menuitem" href="/account" onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-[var(--surface-muted)]">
            Account & billing
          </Link>
          <Link role="menuitem" href="/studio" onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-[var(--surface-muted)]">
            Studio
          </Link>
          {me.plan === "free" ? (
            <Link role="menuitem" href="/pricing" onClick={() => setOpen(false)} className="block px-4 py-2.5 font-medium text-[var(--accent)] hover:bg-[var(--surface-muted)]">
              Upgrade to Pro
            </Link>
          ) : null}
          <button
            role="menuitem"
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void signOut();
            }}
            className="block w-full border-t border-[var(--line)] px-4 py-2.5 text-left text-[var(--ink)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
