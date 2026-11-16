"use client";

import type { MouseEvent } from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "@/lib/themeContext";
import { useReducedMotion } from "@/lib/useReducedMotion";

export function ThemeToggle() {
  // ThemeProvider is always mounted in the root layout, so the hook can be
  // called unconditionally — calling it inside a try/catch would break the
  // rules of hooks.
  const { theme, toggleTheme } = useTheme();
  const reducedMotion = useReducedMotion();

  // The ripple starts at the centre of the button the user actually pressed.
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (reducedMotion) {
      toggleTheme();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    toggleTheme({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  };

  return (
    <button
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
      onClick={handleClick}
      type="button"
    >
      {theme === "light" ? (
        <FiMoon className="h-5 w-5 text-[var(--foreground)]" />
      ) : (
        <FiSun className="h-5 w-5 text-[var(--foreground)]" />
      )}
    </button>
  );
}
