"use client";

import { useEffect, useState } from "react";

/**
 * True when the user asked the system to reduce motion.
 *
 * Animations are removed, never the behaviour behind them: a drag still
 * settles on the same detent, it just arrives instantly.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const list = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(list.matches);

    const onChange = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };

    list.addEventListener("change", onChange);
    return () => {
      list.removeEventListener("change", onChange);
    };
  }, []);

  return reduced;
}
