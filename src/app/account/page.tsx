import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/auth/SignOutButton";
import NotConfigured from "@/components/site/NotConfigured";
import { isAuthConfigured } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false },
};

export default async function AccountPage() {
  if (!isAuthConfigured()) {
    return (
      <NotConfigured
        title="Accounts aren't set up yet"
        detail="Set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET to enable accounts."
      />
    );
  }
  const user = await getSessionUser();
  if (!user) redirect("/sign-in?next=/account");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Account
        </h1>
        <SignOutButton />
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">{user.email}</p>
    </main>
  );
}
