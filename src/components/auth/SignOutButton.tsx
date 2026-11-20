"use client";

import { useState } from "react";
import { signOut } from "@/lib/auth/session-client";

export default function SignOutButton({
  everywhere = false,
  className,
  children,
}: {
  everywhere?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signOut({ everywhere });
      }}
      className={
        className ??
        "min-h-[40px] rounded-full border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink)] disabled:opacity-50"
      }
    >
      {busy ? "Signing out…" : (children ?? (everywhere ? "Sign out everywhere" : "Sign out"))}
    </button>
  );
}
