"use client";

import Link from "next/link";
import { FaSignOutAlt, FaUser } from "react-icons/fa";
import { ThemeToggle } from "@/components/ThemeToggle";

interface MapOverlaysProps {
  displayName: string;
  onLogout: () => void;
  theme: string;
}

/**
 * The passenger's navigation chrome: a bottom bar on small screens and a
 * card in the top-left corner on large ones.
 */
export function MapOverlays({
  displayName,
  theme,
  onLogout,
}: MapOverlaysProps) {
  return (
    <>
      <div className="fixed right-0 bottom-0 left-0 z-30 flex items-center justify-between border-[var(--border)] border-t bg-[var(--surface)]/95 px-4 py-3 backdrop-blur md:hidden">
        <Link
          className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 ${
            theme === "light"
              ? "border-sky-600 bg-white text-slate-800"
              : "border-sky-400 bg-sky-700 text-white"
          }`}
          href="/profile"
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-base ${
              theme === "light"
                ? "bg-sky-100 text-sky-700"
                : "bg-sky-600 text-white"
            }`}
          >
            <FaUser />
          </div>
          <p
            className={`font-semibold text-base ${
              theme === "light" ? "text-slate-900" : "text-white"
            }`}
          >
            {displayName}
          </p>
        </Link>
        <div className="flex items-center gap-2">
          <div
            className={`flex h-11 items-center justify-center rounded-xl border-2 px-2 ${
              theme === "light"
                ? "border-slate-300 bg-white"
                : "border-slate-500 bg-slate-700"
            }`}
          >
            <ThemeToggle />
          </div>
          <button
            className={`inline-flex h-11 items-center justify-center rounded-xl border-2 px-4 font-semibold text-sm ${
              theme === "light"
                ? "border-rose-500 bg-white text-rose-600"
                : "border-rose-400 bg-rose-600 text-white"
            }`}
            onClick={onLogout}
            type="button"
          >
            <FaSignOutAlt className="mr-1.5 text-base" />
            Logout
          </button>
        </div>
      </div>

      <div className="absolute top-4 left-4 z-20 hidden md:block">
        <div className="flex items-center gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 shadow-xl backdrop-blur">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-lg text-sky-300">
            <FaUser />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-white">{displayName}</p>
          </div>
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-3 py-2 font-medium text-sm text-white shadow transition-colors hover:bg-sky-400"
            href="/profile"
          >
            <FaUser className="text-xs" />
            Profile
          </Link>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-2 font-medium text-rose-400 text-sm transition-colors hover:bg-rose-500/30"
            onClick={onLogout}
            type="button"
          >
            <FaSignOutAlt className="text-xs" />
            Logout
          </button>
        </div>
      </div>
    </>
  );
}
