"use client";

import dynamic from "next/dynamic";

/** Studio is browser-only (canvas, ImageBitmap, localStorage). */
const Studio = dynamic(() => import("./Studio"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-[1600px] items-center justify-center px-4 text-sm text-[var(--muted)]">
      Loading studio…
    </div>
  ),
});

export default function StudioLoader() {
  return <Studio />;
}
