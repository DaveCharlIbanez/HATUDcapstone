"use client";

interface AppLoaderProps {
  /** Text announced to screen readers. */
  label?: string;
  /** `full` fills the screen, `inline` fits inside a button. */
  variant?: "full" | "inline";
}

/**
 * The one loading animation in the app.
 *
 * The app used to have six different treatments for the same idea: a spinning
 * icon on some screens, a bare "Loading..." string on others, and a button
 * that swapped its label for "Signing in...". This is the single replacement
 * for all of them.
 */
export function AppLoader({
  label = "Loading",
  variant = "full",
}: AppLoaderProps) {
  const dots = (
    <span aria-hidden="true" className="flex items-center gap-1.5">
      <span className="loader-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
      <span className="loader-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
      <span className="loader-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
    </span>
  );

  if (variant === "inline") {
    return (
      <span className="flex h-6 items-center justify-center gap-2">
        {dots}
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <div
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[var(--background)]"
      role="status"
    >
      <p className="font-bold text-[var(--foreground)] text-xl tracking-[0.3em]">
        HATUD
      </p>
      {dots}
      <span className="sr-only">{label}</span>
    </div>
  );
}
