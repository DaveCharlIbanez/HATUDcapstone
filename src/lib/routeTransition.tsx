"use client";

import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/**
 * Page-to-page motion between the landing page and sign-in (fixoct50).
 *
 * A native-style push and pop, driven by `transform`:
 *
 * - **forward** (landing → sign in): the page you leave slides a little to the
 *   left, and the new one slides in from the right edge.
 * - **back** (sign in → landing): the page you leave slides out to the right,
 *   and the one underneath glides back in from the left.
 *
 * The leaving page plays its exit first, then the route changes, and the
 * arriving page plays its entrance. Opacity is used only lightly on the page
 * that is leaving; there is no fade between pages. Users who prefer reduced
 * motion navigate instantly. See `.route-stage` in `globals.css`.
 *
 * The direction is handed to the next page through `sessionStorage`, which
 * may be unavailable (private mode, blocked site data): every access is
 * guarded, and the worst case is a page that appears without its entrance.
 */
export type RouteDirection = "forward" | "back";

const STORAGE_KEY = "hatud.routeTransition";
/** Matches the exit animation in `globals.css`. */
const LEAVE_MS = 220;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function remember(direction: RouteDirection) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, direction);
  } catch {
    // Without storage the next page simply appears without its entrance.
  }
}

function takeRemembered(): RouteDirection | null {
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    return value === "forward" || value === "back" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Navigate with motion. `leaving` is set while this page plays its exit, and
 * goes on the page's `<RouteStage>`.
 */
export function useRouteTransition(prefetch: string[] = []) {
  const router = useRouter();
  const [leaving, setLeaving] = useState<RouteDirection | null>(null);
  const timer = useRef<number | null>(null);
  const prefetchKey = prefetch.join("|");

  // Load the next page's code ahead of time, so the entrance starts the
  // moment the exit ends instead of waiting on the network.
  useEffect(() => {
    for (const href of prefetchKey ? prefetchKey.split("|") : []) {
      router.prefetch(href);
    }
  }, [router, prefetchKey]);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    []
  );

  const go = useCallback(
    (href: string, direction: RouteDirection) => {
      if (leaving) {
        return; // Already on the way; a double tap is not a second trip.
      }
      if (prefersReducedMotion()) {
        router.push(href);
        return;
      }
      remember(direction);
      setLeaving(direction);
      timer.current = window.setTimeout(() => router.push(href), LEAVE_MS);
    },
    [leaving, router]
  );

  return { go, leaving };
}

/**
 * Wraps a page so it can enter and leave with motion.
 *
 * The entrance is read before the first paint, so the page never flashes in
 * its resting place before it slides.
 */
export function RouteStage({
  children,
  leaving = null,
}: {
  children: ReactNode;
  leaving?: RouteDirection | null;
}) {
  const [entering, setEntering] = useState<RouteDirection | null>(null);

  useLayoutEffect(() => {
    const direction = takeRemembered();
    if (direction && !prefersReducedMotion()) {
      setEntering(direction);
    }
  }, []);

  return (
    <div className="route-viewport">
      <div
        className="route-stage"
        data-route-enter={entering ?? undefined}
        data-route-leave={leaving ?? undefined}
        onAnimationEnd={(event) => {
          // Only the stage's own entrance, not an animation inside the page.
          if (event.target === event.currentTarget && !leaving) {
            setEntering(null);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
