"use client";

import type { ReactNode } from "react";

interface DetailRowProps {
  /** Secondary detail. Wraps rather than overflowing on a narrow phone. */
  meta?: ReactNode;
  title: ReactNode;
  /** Right-aligned content, usually a status pill. */
  trailing?: ReactNode;
}

/**
 * One record inside a metric panel.
 */
export function DetailRow({ meta, title, trailing }: DetailRowProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-[var(--foreground)] text-sm">
          {title}
        </p>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {meta ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--text-muted)] text-sm">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

type PillTone = "amber" | "emerald" | "rose" | "sky" | "slate";

const PILL_TONES: Record<PillTone, string> = {
  amber: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  rose: "bg-rose-500/20 text-rose-600 dark:text-rose-400",
  sky: "bg-sky-500/20 text-sky-600 dark:text-sky-400",
  slate: "bg-[var(--surface-muted)] text-[var(--text-muted)]",
};

/**
 * A small coloured label, e.g. "Online" or "Pending".
 */
export function StatusPill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: PillTone;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 font-semibold text-xs ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * Shown when a metric has no records behind it. A panel is never left blank.
 */
export function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-6 text-center text-[var(--text-muted)] text-sm">
      {message}
    </p>
  );
}

/**
 * Placeholder rows while the dashboard snapshot is in flight.
 */
export function PanelSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3">
      {[0, 1, 2].map((index) => (
        <div
          className="h-16 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
          key={index}
        />
      ))}
    </div>
  );
}
