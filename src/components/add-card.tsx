"use client";

/** Dashed "+" card that starts the add flow; used as the first card in feeds. */
export function AddCard({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-card/60 p-4 text-left transition-colors hover:bg-ink/5"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-xl leading-none text-accent-ink transition-transform group-hover:scale-105" aria-hidden>
        +
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block truncate text-sm text-muted">{sub}</span>
      </span>
    </button>
  );
}
