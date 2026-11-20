import Link from "next/link";
import { APPLE_DISCLAIMER } from "@/lib/site";

const LINKS = [
  { href: "/studio", label: "Editor" },
  { href: "/pricing", label: "Pricing" },
  { href: "/support", label: "Support" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund", label: "Refunds" },
];

export default function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-[var(--line)] bg-[var(--surface)]/60">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-8 text-sm text-[var(--muted)] sm:px-6">
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-[var(--ink)]">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs leading-relaxed">
          © {new Date().getFullYear()} ASC Studio. {APPLE_DISCLAIMER}
        </p>
      </div>
    </footer>
  );
}
