"use client";

import { useEffect } from "react";
import { FaExclamationTriangle } from "react-icons/fa";

/**
 * Catches errors thrown by the root layout itself. `app/error.tsx` only
 * covers the pages below the layout, so a failure inside a provider mounted
 * in the layout needs this boundary to avoid a blank page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replace with a reporting service in production.
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[var(--background)] text-[var(--foreground)]">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <FaExclamationTriangle className="mx-auto mb-3 text-3xl text-red-400" />
            <h1 className="mb-2 font-bold text-lg">Something went wrong</h1>
            <p className="mb-4 text-[var(--text-muted)] text-sm">
              The app could not start. Try again, and sign in again if you keep
              seeing this.
            </p>
            <button
              className="w-full rounded-xl bg-sky-500 py-3 font-semibold text-white transition hover:bg-sky-400"
              onClick={reset}
              type="button"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
