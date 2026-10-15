"use client";

import { cx } from "@/lib/util";

/**
 * Accessible on/off switch (role="switch").
 * Track 36×20px, knob 16px with a 2px inset: off at x=2, on at x=18.
 * The track is a flex box (not an inline span) so its size always applies.
 */
export function Toggle({
  label,
  on,
  onChange,
  disabled,
  tone = "light",
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  /** "dark" for use on the ink-coloured admin bar. */
  tone?: "light" | "dark";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx(
        "inline-flex shrink-0 items-center gap-2 rounded-full py-1 pr-2 pl-1 text-[13px] leading-none transition-colors disabled:opacity-50",
        tone === "dark" ? "hover:bg-paper/10" : "hover:bg-ink/5"
      )}
    >
      <span
        aria-hidden
        className={cx(
          "inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          on ? "bg-live" : tone === "dark" ? "bg-paper/25" : "bg-ink/20"
        )}
      >
        <span
          className={cx(
            "block size-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            on ? "translate-x-[18px]" : "translate-x-[2px]"
          )}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}
