"use client";

import { useEffect, useRef } from "react";
import { FaCamera, FaFolderOpen, FaTrash } from "react-icons/fa";

export type CaptureSource = "camera" | "file";

interface CaptureSheetProps {
  /** True when the document has already been uploaded. */
  canRemove: boolean;
  isOpen: boolean;
  onClose: () => void;
  onPick: (source: CaptureSource, file: File) => void;
  onRemove: () => void;
  title: string;
}
/**
 * The bottom sheet a driver picks a document from.
 *
 * Two separate targets, because on a phone they are different jobs: the
 * camera captures a document on the spot, and the file picker reaches the
 * gallery and the file explorer for a document that was already saved.
 */
export function CaptureSheet({
  canRemove,
  isOpen,
  onClose,
  onPick,
  onRemove,
  title,
}: CaptureSheetProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so picking the same file twice still fires a change.
    event.target.value = "";
    if (file) {
      onPick("camera", file);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      onPick("file", file);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />

      <div
        aria-label={title}
        aria-modal="true"
        className="relative w-full max-w-md rounded-t-3xl border-[var(--border)] border-t bg-[var(--surface)] p-5 pb-8 shadow-2xl"
        role="dialog"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--surface-muted)]" />

        <p className="text-center font-semibold text-[var(--foreground)]">
          {title}
        </p>

        <div className="mt-5 space-y-3">
          <button
            className="flex min-h-14 w-full items-center gap-4 rounded-2xl bg-[var(--surface-strong)] px-5 text-left transition hover:bg-[var(--surface-muted)]"
            onClick={() => cameraInputRef.current?.click()}
            type="button"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <FaCamera className="text-lg" />
            </span>
            <span>
              <span className="block font-semibold text-[var(--foreground)] text-sm">
                Take a photo
              </span>
              <span className="block text-[var(--text-muted)] text-sm">
                Use the camera now
              </span>
            </span>
          </button>

          <button
            className="flex min-h-14 w-full items-center gap-4 rounded-2xl bg-[var(--surface-strong)] px-5 text-left transition hover:bg-[var(--surface-muted)]"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <FaFolderOpen className="text-lg" />
            </span>
            <span>
              <span className="block font-semibold text-[var(--foreground)] text-sm">
                Select file
              </span>
              <span className="block text-[var(--text-muted)] text-sm">
                From your gallery or files
              </span>
            </span>
          </button>

          {canRemove ? (
            <button
              className="flex min-h-14 w-full items-center gap-4 rounded-2xl px-5 text-left text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"
              onClick={onRemove}
              type="button"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15">
                <FaTrash className="text-lg" />
              </span>
              <span className="font-semibold text-sm">Remove document</span>
            </button>
          ) : null}

          <button
            className="min-h-14 w-full rounded-2xl bg-[var(--surface-muted)] font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-strong)]"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
        </div>

        {/*
          The camera input needs `image/*` for Capacitor to route it to the
          camera at all — with a narrower accept attribute the bridge ignores
          `capture` and opens the file picker instead. The file input uses the
          narrow attribute so the system picker only offers PNG and JPG.
        */}
        <input
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleChange}
          ref={cameraInputRef}
          type="file"
        />
        <input
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />
      </div>
    </div>
  );
}
