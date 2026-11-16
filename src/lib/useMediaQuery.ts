"use client";

import { useEffect, useState } from "react";

/**
 * Reads a CSS media query and re-renders when it changes.
 *
 * The initial value is `false` on both the server and the first client render
 * so the markup matches. The effect then corrects it, which costs one extra
 * render but never a hydration mismatch.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    list.addEventListener("change", onChange);
    return () => {
      list.removeEventListener("change", onChange);
    };
  }, [query]);

  return matches;
}
