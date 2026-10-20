"use client";

import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "@/lib/themeContext";

export function ThemeToggle() {
  let theme = "light";
  let toggleTheme = () => {};

  try {
    const context = useTheme();
    theme = context.theme;
    toggleTheme = context.toggleTheme;
  } catch {
    // ThemeProvider not available during SSR/static generation
  }

  return (
    <button
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-muted)]"
      onClick={toggleTheme}
    >
      {theme === "light" ? (
        <FiMoon className="h-5 w-5 text-[var(--foreground)]" />
      ) : (
        <FiSun className="h-5 w-5 text-[var(--foreground)]" />
      )}
    </button>
  );
}
