"use client";

import { FaCheckCircle, FaPlayCircle } from "react-icons/fa";

interface DemoModeToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

/**
 * The switch between a live trip and a demo trip.
 *
 * A demo trip is driven along the road by the server once it starts, at
 * 30–50 km/h, and ends at the destination. Without it the trip follows GPS.
 *
 * The switch never moves the page. It is one row of fixed height that is
 * always there: turning it on only cross-fades what the row says. Both
 * labels sit in the same grid cell, so the row is as wide and as tall either
 * way and nothing above or below it shifts.
 */
export function DemoModeToggle({ enabled, onChange }: DemoModeToggleProps) {
  return (
    <button
      aria-checked={enabled}
      aria-label="Demo mode"
      className={`grid h-11 w-full items-center rounded-2xl border px-4 text-left text-sm transition-colors duration-300 ${
        enabled
          ? "border-amber-400 bg-white text-slate-900 ring-1 ring-amber-400"
          : "border-[var(--border)] border-dashed bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface)]"
      }`}
      data-testid="demo-mode-toggle"
      onClick={() => onChange(!enabled)}
      role="switch"
      type="button"
    >
      <span
        aria-hidden={enabled}
        className={`col-start-1 row-start-1 flex items-center justify-between gap-3 transition-all duration-300 ${
          enabled ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <span className="flex items-center gap-2 font-medium">
          <FaPlayCircle className="shrink-0" />
          Try demo mode
        </span>
        <span className="text-xs">simulated trip</span>
      </span>
      <span
        aria-hidden={!enabled}
        className={`col-start-1 row-start-1 flex items-center justify-between gap-3 transition-all duration-300 ${
          enabled ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        }`}
      >
        <span className="flex items-center gap-2 font-semibold">
          <FaCheckCircle className="shrink-0" />
          Demo mode enabled
        </span>
        <span className="text-xs underline underline-offset-2">Undo</span>
      </span>
      <span aria-live="polite" className="sr-only">
        {enabled ? "Demo mode enabled" : "Demo mode off"}
      </span>
    </button>
  );
}
