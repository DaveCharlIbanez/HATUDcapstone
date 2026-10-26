"use client";

import { FaCamera, FaCheck, FaFileImage, FaRedo } from "react-icons/fa";
import type { DocumentKind } from "@/lib/documentImage";

export type DocumentUploadState =
  | { status: "empty" }
  | { error: string; status: "error" }
  | { percent: number; status: "uploading" }
  | { status: "uploaded" };

interface DocumentTileProps {
  hint: string;
  kind: DocumentKind;
  label: string;
  onPress: () => void;
  state: DocumentUploadState;
}

const STATE_LABELS: Record<DocumentUploadState["status"], string> = {
  empty: "Not uploaded",
  error: "Failed — tap to retry",
  uploading: "Uploading",
  uploaded: "Uploaded",
};

const CHIP_STYLES = {
  error: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  uploaded: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  neutral: "bg-[var(--surface-muted)] text-[var(--text-muted)]",
} as const;

const TILE_STYLES = {
  error: "border-rose-500/40 bg-rose-500/5",
  uploaded: "border-emerald-500/40 bg-emerald-500/5",
  neutral:
    "border-[var(--border)] bg-[var(--surface-strong)] hover:bg-[var(--surface-muted)]",
} as const;

const LABEL_STYLES = {
  error: "text-rose-600 dark:text-rose-400",
  uploaded: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-[var(--text-muted)]",
} as const;

/**
 * One document in the upload list.
 *
 * Every state the tile can be in is visible on the tile itself, so a driver
 * can see exactly which of the four documents is still outstanding.
 */
export function DocumentTile({
  hint,
  label,
  kind,
  onPress,
  state,
}: DocumentTileProps) {
  const tone: keyof typeof CHIP_STYLES = (() => {
    if (state.status === "uploaded") {
      return "uploaded";
    }
    if (state.status === "error") {
      return "error";
    }
    return "neutral";
  })();

  const chip = (() => {
    if (state.status === "uploaded") {
      return <FaCheck className="text-lg" />;
    }
    if (state.status === "error") {
      return <FaRedo className="text-lg" />;
    }
    if (state.status === "uploading") {
      return <FaFileImage className="animate-pulse text-lg" />;
    }
    return <FaCamera className="text-lg" />;
  })();

  const statusText =
    state.status === "uploading"
      ? `${state.percent}%`
      : STATE_LABELS[state.status];

  return (
    <button
      aria-describedby={`document-${kind}-hint`}
      className={`flex min-h-[5rem] w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${TILE_STYLES[tone]}`}
      onClick={onPress}
      type="button"
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${CHIP_STYLES[tone]}`}
      >
        {chip}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[var(--foreground)] text-sm">
          {label}
        </span>
        <span
          className="mt-0.5 block text-[var(--text-muted)] text-sm"
          id={`document-${kind}-hint`}
        >
          {state.status === "error" ? state.error : hint}
        </span>
      </span>

      <span
        className={`shrink-0 text-right font-semibold text-sm tabular-nums ${LABEL_STYLES[tone]}`}
      >
        {statusText}
      </span>
    </button>
  );
}
