"use client";

import { useMutation, useQuery } from "convex/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "./authContext";

type Theme = "light" | "dark";

interface ThemeContextType {
  setTheme: (theme: Theme) => void;
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "hatud_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { sessionToken } = useAuth();
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  const themePreference = useQuery(
    api.theme.getUserTheme,
    sessionToken ? { sessionToken } : "skip"
  );

  const setUserTheme = useMutation(api.theme.setUserTheme);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") {
      setThemeState(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  useEffect(() => {
    if (themePreference === undefined) {
      return;
    }
    if (themePreference === null) {
      return;
    }

    setThemeState(themePreference);
    document.documentElement.setAttribute("data-theme", themePreference);
    localStorage.setItem(STORAGE_KEY, themePreference);
  }, [themePreference]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem(STORAGE_KEY, newTheme);

      if (sessionToken) {
        setUserTheme({ sessionToken, theme: newTheme }).catch(console.error);
      }
    },
    [sessionToken, setUserTheme]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
