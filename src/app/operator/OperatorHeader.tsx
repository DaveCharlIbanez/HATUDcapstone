"use client";

import Link from "next/link";
import {
  FaSignOutAlt,
  FaToggleOff,
  FaToggleOn,
  FaUserTie,
} from "react-icons/fa";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface OperatorProfileView {
  name: string;
  vehicleInfo: { plateNumber: string; model: string };
}

interface OperatorHeaderProps {
  offlineClassName: string;
  onLogout: () => void;
  online: boolean;
  onlineClassName: string;
  onToggleOnline: () => void;
  profile: OperatorProfileView | undefined;
  theme: string;
}

export function OperatorHeader({
  profile,
  theme,
  online,
  onlineClassName,
  offlineClassName,
  onLogout,
  onToggleOnline,
}: OperatorHeaderProps) {
  return (
    <>
      <div className="absolute top-0 right-0 left-0 z-10 hidden bg-gradient-to-b from-black/50 to-transparent p-4 md:block">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-white">
              <FaUserTie className="text-lg" />
            </div>
            <div>
              <h1 className="font-semibold text-lg text-white">
                {profile?.name ?? "Loading..."}
              </h1>
              <p className="text-[var(--text-muted)] text-sm">
                {profile?.vehicleInfo.model ?? ""} •{" "}
                {profile?.vehicleInfo.plateNumber ?? ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <Link
              className="btn btn-secondary rounded-full px-3 py-2 text-sm sm:px-4"
              href="/operator/profile"
            >
              <FaUserTie />
              <span className="hidden sm:inline">Profile</span>
            </Link>
            <button
              className="btn btn-secondary rounded-full px-3 py-2 text-rose-400 text-sm hover:text-rose-300 sm:px-4"
              onClick={onLogout}
              type="button"
            >
              <FaSignOutAlt />
              <span className="hidden sm:inline">Logout</span>
            </button>
            <button
              className={`btn rounded-full px-3 py-2 text-sm sm:px-4 ${online ? "btn-success" : "btn-secondary"}`}
              onClick={onToggleOnline}
              type="button"
            >
              {online ? <FaToggleOn /> : <FaToggleOff />}
              {online ? "Online" : "Offline"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile: Bottom navigation bar - larger for touch accessibility */}
      <div className="fixed right-0 bottom-0 left-0 z-20 flex items-center justify-between border-[var(--border)] border-t bg-[var(--surface)]/95 px-4 py-3 backdrop-blur md:hidden">
        <Link
          className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 ${
            theme === "light"
              ? "border-sky-600 bg-white text-slate-800"
              : "border-sky-500/50 bg-slate-800 text-white"
          }`}
          href="/operator/profile"
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-base ${
              theme === "light"
                ? "bg-sky-100 text-sky-700"
                : "bg-slate-700 text-white"
            }`}
          >
            <FaUserTie />
          </div>
          <div className="min-w-0">
            <p
              className={`truncate font-semibold text-sm ${
                theme === "light" ? "text-slate-900" : "text-white"
              }`}
            >
              {profile?.name ?? "Loading..."}
            </p>
            <p
              className={`truncate text-xs ${
                theme === "light" ? "text-slate-500" : "text-slate-400"
              }`}
            >
              {profile?.vehicleInfo.plateNumber ?? ""}
            </p>
          </div>
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
            className={`inline-flex h-11 items-center justify-center rounded-xl border-2 px-4 ${
              theme === "light"
                ? "border-rose-500 bg-white text-rose-600"
                : "border-rose-400 bg-rose-600 text-white"
            }`}
            onClick={onLogout}
            type="button"
          >
            <FaSignOutAlt className="text-sm" />
          </button>
          <button
            className={`inline-flex h-11 items-center justify-center gap-1 rounded-xl px-4 font-semibold text-sm ${
              online ? onlineClassName : offlineClassName
            }`}
            onClick={onToggleOnline}
            type="button"
          >
            {online ? (
              <FaToggleOn className="text-base" />
            ) : (
              <FaToggleOff className="text-base" />
            )}
            <span>{online ? "Online" : "Offline"}</span>
          </button>
        </div>
      </div>
    </>
  );
}
