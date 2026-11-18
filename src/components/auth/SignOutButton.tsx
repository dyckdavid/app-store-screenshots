"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export default function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await authClient.signOut();
        } finally {
          window.location.href = "/";
        }
      }}
      className="min-h-[40px] rounded-full border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink)] disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
