import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignInForm from "@/components/auth/SignInForm";
import NotConfigured from "@/components/site/NotConfigured";
import {
  isAppleSignInEnabled,
  isAuthConfigured,
  safeNextPath,
} from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to ASC Studio to unlock AI actions, cloud presets, and Pro.",
  robots: { index: false },
  alternates: { canonical: "/sign-in" },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNextPath(rawNext, "/studio");
  const initialError = error
    ? error === "oauth"
      ? "Google sign-in didn't complete. Try again or use an email code."
      : "Sign-in didn't complete. Please try again."
    : null;

  if (!isAuthConfigured()) {
    return (
      <NotConfigured
        title="Accounts aren't set up yet"
        detail="This deployment has no Neon Auth configuration (NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET). The editor still works without an account."
      />
    );
  }

  const user = await getSessionUser();
  if (user) redirect(next);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <div className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          No password needed. New here? Signing in creates your free account.
        </p>
        <div className="mt-6">
          <SignInForm next={next} appleEnabled={isAppleSignInEnabled()} initialError={initialError} />
        </div>
        <p className="mt-6 text-xs text-[var(--muted)]">
          By continuing you agree to the <Link className="underline" href="/terms">Terms</Link>{" "}
          and <Link className="underline" href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
