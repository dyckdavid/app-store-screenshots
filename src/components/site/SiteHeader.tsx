"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEntitlements } from "@/lib/billing/use-entitlements";
import AccountMenu from "./AccountMenu";

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
        className="whitespace-nowrap font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)]"
      >
        ASC Studio
      </Link>
      <nav className="flex items-center gap-1 text-sm">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${item.href === "/support" ? "hidden sm:inline-block" : ""} whitespace-nowrap rounded-full px-2.5 py-2 sm:px-3 ${
              pathname?.startsWith(item.href)
                ? "bg-[var(--surface-muted)] text-[var(--ink)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {item.label}
          </Link>
        ))}
        {data?.signedIn ? (
          <AccountMenu me={data} />
        ) : data?.authConfigured === false ? null : (
          <Link
            href={`/sign-in?next=${encodeURIComponent(pathname || "/studio")}`}
            className="ml-1 whitespace-nowrap rounded-full bg-[var(--accent)] px-4 py-2 font-medium text-white"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
