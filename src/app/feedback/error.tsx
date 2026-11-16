"use client";

import { useEffect } from "react";

/**
 * The backstop for the rating screen.
 *
 * A Convex query that throws does so during render. Without a boundary above
 * it, the framework's error screen replaces the page — and a passenger who
 * came here to rate a driver would lose the form over a failed lookup.
 */
export default function FeedbackError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("The rating screen failed to load:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <h1 className="font-bold text-[var(--foreground)] text-xl">
          Something went wrong
        </h1>
        <p className="mt-2 text-[var(--text-muted)] text-sm">
          We could not load the rating screen. Your trip is safe — you can rate
          it from your profile, or try again.
        </p>
        <button
          className="mt-6 w-full rounded-xl bg-sky-500 py-3 font-semibold text-white transition-colors hover:bg-sky-400"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
