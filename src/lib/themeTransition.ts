/**
 * The circular theme transition.
 *
 * Switching between light and dark mode used to be a hard cut on everything
 * except the app shell. The View Transitions API turns it into a ripple: a
 * circle of the new theme grows out of the control the user touched and
 * carries the new theme across the page.
 */

export interface ThemeTransitionOrigin {
  /** Viewport coordinates of the centre of the ripple. */
  x: number;
  y: number;
}

/** Matches `--motion-ripple-duration` in `globals.css`. */
const RIPPLE_DURATION_MS = 460;

/** Matches `--motion-ripple-easing` in `globals.css`. */
const RIPPLE_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

/**
 * True when the browser can run a view transition. The Android WebView that
 * ships with the Capacitor build depends on the System WebView version, so
 * this cannot be assumed.
 */
export function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && "startViewTransition" in document;
}

/**
 * The radius that reaches the farthest corner of the viewport from the
 * origin. Anything smaller leaves an uncovered sliver.
 */
function rippleRadius(origin: ThemeTransitionOrigin): number {
  return Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y)
  );
}

/**
 * Applies the theme and reveals it with a ripple.
 *
 * `apply` runs inside the transition, so the browser captures the new theme
 * as the "after" state of the page. When the browser has no support for view
 * transitions the theme is simply applied and the shell's own colour
 * transition covers the change.
 */
export async function applyThemeWithRipple(
  origin: ThemeTransitionOrigin,
  apply: () => void
): Promise<void> {
  if (!supportsViewTransitions()) {
    apply();
    return;
  }

  const root = document.documentElement;
  root.setAttribute("data-theme-transition", "active");

  const radius = rippleRadius(origin);

  try {
    const transition = document.startViewTransition(apply);
    await transition.ready;

    const animation = root.animate(
      {
        clipPath: [
          `circle(0px at ${origin.x}px ${origin.y}px)`,
          `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
        ],
      },
      {
        duration: RIPPLE_DURATION_MS,
        easing: RIPPLE_EASING,
        pseudoElement: "::view-transition-new(root)",
      }
    );

    await Promise.all([animation.finished, transition.finished]);
  } catch {
    // The transition was skipped — the tab lost focus, or the browser
    // refused it. The theme is applied either way.
  } finally {
    root.removeAttribute("data-theme-transition");
  }
}
