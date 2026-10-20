"use client";

import { useState } from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "@/lib/themeContext";

export function ThemeSlider() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  if (!mounted) {
    setMounted(true);
  }

  const currentTheme = mounted ? theme : "light";

  const handleToggle = () => {
    setTheme(currentTheme === "light" ? "dark" : "light");
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div>
        <h3 className="font-semibold text-[var(--foreground)]">Dark Mode</h3>
        <p className="text-[var(--text-muted)] text-sm">
          {currentTheme === "dark" ? "Currently enabled" : "Currently disabled"}
        </p>
      </div>
      <button
        aria-checked={currentTheme === "dark"}
        aria-label={`Switch to ${currentTheme === "light" ? "dark" : "light"} mode`}
        className="relative flex h-12 w-24 items-center rounded-full bg-[var(--surface-muted)] p-1 transition-colors hover:bg-[var(--surface-strong)]"
        onClick={handleToggle}
        role="switch"
        type="button"
      >
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] shadow-lg transition-transform duration-200 ${
            currentTheme === "dark" ? "translate-x-12" : "translate-x-0"
          }`}
        >
          {currentTheme === "light" ? (
            <FiSun className="h-5 w-5 text-white" />
          ) : (
            <FiMoon className="h-5 w-5 text-white" />
          )}
        </span>
        <span className="absolute flex w-full justify-between px-2 font-medium text-xs">
          <span
            className={
              currentTheme === "light"
                ? "text-[var(--foreground)]"
                : "text-[var(--text-muted)]"
            }
          >
            Light
          </span>
          <span
            className={
              currentTheme === "dark"
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
