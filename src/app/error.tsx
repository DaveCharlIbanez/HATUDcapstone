"use client";

import { useEffect } from "react";
import { FaExclamationTriangle } from "react-icons/fa";

export default function ErrorBoundary({
  error: thrownError,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replace with a reporting service in production.
    console.error(thrownError);
  }, [thrownError]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <FaExclamationTriangle className="mx-auto mb-3 text-3xl text-red-400" />
        <h1 className="mb-2 font-bold text-[var(--foreground)] text-lg">
          Something went wrong
        </h1>
        <p className="mb-4 text-[var(--text-muted)] text-sm">
          The page could not be displayed. Check your connection and try again.
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
  );
}
