const ITEMS = [
  "Drag-to-reposition text and freeform device placement on the canvas",
  "Per-screenshot caption overrides inside a multi-shot set",
  "App preview (video) compositing and poster-frame export",
  "In-App Event card / details creative sizes (16:9 and 9:16)",
  "Cloud sync for presets (today presets stay in localStorage only)",
  "Official Apple marketing frame packs beyond open community sources",
];

export default function ComingSoon() {
  return (
    <section
      aria-labelledby="coming-soon-heading"
      className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] px-5 py-5"
    >
      <h2
        id="coming-soon-heading"
        className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]"
      >
        Coming soon
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Honest backlog — not shipped yet:
      </p>
      <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)]">
        {ITEMS.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
