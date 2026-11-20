import Link from "next/link";

export default function NotConfigured({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16">
      <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-[var(--surface)] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          Not configured
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{detail}</p>
        <Link
          href="/studio"
          className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-[var(--accent)] px-5 text-sm font-medium text-white"
        >
          Open the editor
        </Link>
      </div>
    </main>
  );
}
