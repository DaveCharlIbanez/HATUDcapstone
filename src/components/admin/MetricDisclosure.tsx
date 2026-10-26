"use client";

import type { IconType } from "react-icons";
import { FaChevronDown } from "react-icons/fa";

interface MetricDisclosureProps {
  children: React.ReactNode;
  /** Secondary line under the label. */
  hint: string;
  icon: IconType;
  isOpen: boolean;
  label: string;
  onToggle: () => void;
  /** The headline number. */
  value: string;
}

/**
 * A metric that expands in place to show the records behind the number.
 *
 * The panel is always mounted and hidden with the `hidden` attribute rather
 * than being unmounted, so `aria-controls` always points at something that
 * exists.
 */
export function MetricDisclosure({
  children,
  hint,
  icon: Icon,
  isOpen,
  label,
  onToggle,
  value,
}: MetricDisclosureProps) {
  const panelId = `metric-panel-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;

  return (
    <section
      className={`overflow-hidden rounded-3xl border bg-[var(--surface)] shadow-sm transition ${
        isOpen ? "border-sky-500/60 border-l-4" : "border-[var(--border)]"
      }`}
    >
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className="flex min-h-[4.5rem] w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-strong)] sm:p-5"
        onClick={onToggle}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-sky-500 dark:text-sky-400">
            <Icon className="text-lg" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-[var(--foreground)]">
              {label}
            </span>
            <span className="mt-0.5 block text-[var(--text-muted)] text-sm">
              {hint}
            </span>
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          <span className="font-semibold text-2xl text-[var(--foreground)] tabular-nums sm:text-3xl">
            {value}
          </span>
          <FaChevronDown
            aria-hidden="true"
            className={`text-sky-500 transition-transform dark:text-sky-400 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
          <span className="sr-only">
            {isOpen ? `Hide ${label} details` : `Show ${label} details`}
          </span>
        </span>
      </button>

      <div
        className="border-[var(--border)] border-t p-4 sm:p-5"
        hidden={!isOpen}
        id={panelId}
      >
        {children}
      </div>
    </section>
  );
}
