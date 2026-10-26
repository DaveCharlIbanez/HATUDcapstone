"use client";

import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "@/lib/themeContext";

export function ThemeToggle() {
  // ThemeProvider is always mounted in the root layout, so the hook can be
  // called unconditionally — calling it inside a try/catch would break the
  // rules of hooks.
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
      onClick={toggleTheme}
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
