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
import {
  applyThemeWithRipple,
  type ThemeTransitionOrigin,
} from "./themeTransition";

type Theme = "light" | "dark";

interface ThemeContextType {
  /**
   * Applies a theme. When an origin is given the change is revealed with a
   * circular ripple that starts at that point.
   */
  setTheme: (theme: Theme, origin?: ThemeTransitionOrigin) => void;
  theme: Theme;
  toggleTheme: (origin?: ThemeTransitionOrigin) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "hatud_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isSessionValidated, sessionToken } = useAuth();
  const [theme, setThemeState] = useState<Theme>("light");

  // Only ask for the preference once the server has confirmed the session is
  // live. Sending a stale token makes the query fail, and this provider lives
  // in the root layout, so the failure would take down the whole app.
  const themePreference = useQuery(
    api.theme.getUserTheme,
    isSessionValidated && sessionToken ? { sessionToken } : "skip"
  );

  const setUserTheme = useMutation(api.theme.setUserTheme);

  useEffect(() => {
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
    (newTheme: Theme, origin?: ThemeTransitionOrigin) => {
      const apply = () => {
        setThemeState(newTheme);
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem(STORAGE_KEY, newTheme);

        if (sessionToken) {
          setUserTheme({ sessionToken, theme: newTheme }).catch(console.error);
        }
      };

      if (!origin) {
        apply();
        return;
      }

      applyThemeWithRipple(origin, apply).catch(() => undefined);
    },
    [sessionToken, setUserTheme]
  );

  const toggleTheme = useCallback(
    (origin?: ThemeTransitionOrigin) => {
      setTheme(theme === "light" ? "dark" : "light", origin);
    },
    [setTheme, theme]
  );

  // The context is always provided. Gating it on `mounted` meant that any
  // component calling `useTheme` threw during server rendering, which broke
  // the static export of the not-found page.
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
