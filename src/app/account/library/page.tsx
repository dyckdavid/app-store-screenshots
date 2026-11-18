import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import NotConfigured from "@/components/site/NotConfigured";
import { isAuthConfigured } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/server";
import { isDbConfigured } from "@/db/client";
import { CATALOG, findProduct } from "@/lib/billing/catalog";
import { getEntitlements } from "@/lib/billing/entitlements";
import { activeKeys } from "@/lib/billing/entitlement-rules";
import * as repo from "@/lib/billing/repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Library", robots: { index: false } };

export default async function LibraryPage() {
  if (!isAuthConfigured() || !isDbConfigured()) {
    return <NotConfigured title="Library unavailable" detail="Accounts or the database aren't configured on this deployment." />;
  }
  const user = await getSessionUser();
  if (!user) redirect("/sign-in?next=/account/library");

  const keys = activeKeys(await getEntitlements(user.id));
  const owned = CATALOG.filter((p) => p.kind === "digital" && keys.has(p.grants)).map((p) => p.key);
  const assets = await repo.listAssetsForProducts(owned);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link href="/account" className="text-sm text-[var(--muted)] underline">← Account</Link>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Your library</h1>
      {assets.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">You don&apos;t own any downloadable products yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-[var(--line)] rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)]">
          {assets.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-[var(--ink)]">{findProduct(a.productKey)?.name ?? a.productKey}</p>
                <p className="text-xs text-[var(--muted)]">
                  {a.filename} · v{a.version} · {(a.sizeBytes / 1024).toFixed(1)} KB
                </p>
              </div>
              <a
                href={`/api/downloads/${a.id}`}
                className="inline-flex min-h-[40px] items-center rounded-full bg-[var(--accent)] px-4 text-sm font-medium text-white"
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
