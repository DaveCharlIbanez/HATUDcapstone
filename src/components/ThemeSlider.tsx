"use client";

import { useRef } from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "@/lib/themeContext";
import { useReducedMotion } from "@/lib/useReducedMotion";

export function ThemeSlider() {
  // The provider always exposes a theme, so there is no need for a local
  // mounted flag (and no setState during render).
  const { theme, setTheme } = useTheme();
  const reducedMotion = useReducedMotion();
  const knobRef = useRef<HTMLSpanElement>(null);

  // The ripple starts at the knob, not at the switch: the knob is where the
  // user's eye already is.
  const handleToggle = () => {
    const knob = knobRef.current;

    if (reducedMotion || !knob) {
      setTheme(theme === "light" ? "dark" : "light");
      return;
    }

    const rect = knob.getBoundingClientRect();
    setTheme(theme === "light" ? "dark" : "light", {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div>
        <h3 className="font-semibold text-[var(--foreground)]">Dark Mode</h3>
        <p className="text-[var(--text-muted)] text-sm">
          {theme === "dark" ? "Currently enabled" : "Currently disabled"}
        </p>
      </div>
      <button
        aria-checked={theme === "dark"}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        className="relative flex h-12 w-24 items-center rounded-full bg-[var(--surface-muted)] p-1 transition-colors hover:bg-[var(--surface-strong)]"
        onClick={handleToggle}
        role="switch"
        type="button"
      >
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] shadow-lg transition-transform duration-200 ${
            theme === "dark" ? "translate-x-12" : "translate-x-0"
          }`}
          ref={knobRef}
        >
          {theme === "light" ? (
            <FiSun className="h-5 w-5 text-white" />
          ) : (
            <FiMoon className="h-5 w-5 text-white" />
          )}
        </span>
        <span className="absolute flex w-full justify-between px-2 font-medium text-xs">
          <span
            className={
              theme === "light"
                ? "text-[var(--foreground)]"
                : "text-[var(--text-muted)]"
            }
          >
            Light
          </span>
          <span
            className={
              theme === "dark"
                ? "text-[var(--foreground)]"
                : "text-[var(--text-muted)]"
            }
          >
            Dark
          </span>
        </span>
      </button>
    </div>
  );
}
