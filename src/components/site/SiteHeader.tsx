"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEntitlements } from "@/lib/billing/use-entitlements";

const NAV = [
  { href: "/studio", label: "Editor" },
  { href: "/pricing", label: "Pricing" },
  { href: "/support", label: "Support" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const { data } = useEntitlements();

  return (
    <header className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-4 pt-4 sm:px-6">
      <Link
        href="/"
        className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)]"
      >
        ASC Studio
      </Link>
      <nav className="flex items-center gap-1 text-sm">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3 py-2 ${
              pathname?.startsWith(item.href)
                ? "bg-[var(--surface-muted)] text-[var(--ink)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {item.label}
          </Link>
        ))}
        {data?.signedIn ? (
          <Link
            href="/account"
            className="ml-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)]"
          >
            {data.plan === "free" ? "Account" : `Account · ${data.plan === "pro" ? "Pro" : "Lifetime"}`}
          </Link>
        ) : (
          <Link
            href={`/sign-in?next=${encodeURIComponent(pathname || "/studio")}`}
            className="ml-1 rounded-full bg-[var(--accent)] px-4 py-2 font-medium text-white"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
