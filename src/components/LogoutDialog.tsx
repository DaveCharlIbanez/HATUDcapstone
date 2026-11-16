"use client";

import { useEffect, useRef } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { useAuth } from "@/lib/authContext";
import { trapFocus } from "@/lib/focusTrap";

interface LogoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Confirms a sign-out and names the account being signed out.
 *
 * Signing out revokes the session on the server and clears the token, so it
 * cannot be undone without the password. The dialog puts the cost of a
 * mis-tap on the person who made it: the account name is spelled out, the
 * safe action (Cancel) is the one that receives focus, and Escape leaves
 * the session alone.
 */
export function LogoutDialog({ isOpen, onClose }: LogoutDialogProps) {
  const { logout, user } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const accountName = user?.name || user?.email || "your account";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      trapFocus(event, panelRef.current);
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  // Return focus to whatever opened the dialog once it closes.
  useEffect(() => {
    if (!isOpen) {
      restoreFocusRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        aria-label="Close the sign out dialog"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div
        aria-describedby="logout-dialog-description"
        aria-labelledby="logout-dialog-title"
        aria-modal="true"
        className="relative w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
        ref={panelRef}
        role="dialog"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500 dark:text-rose-400">
          <FaSignOutAlt className="text-xl" />
        </div>

        <h2
          className="mt-5 font-semibold text-2xl text-[var(--foreground)]"
          id="logout-dialog-title"
        >
          Sign out of HATUD?
        </h2>

        <p className="mt-2 text-[var(--foreground)] text-sm">
          You are logging out of{" "}
          <span className="font-semibold">{accountName}</span>.
        </p>
        <p
          className="mt-1 text-[var(--text-muted)] text-sm"
          id="logout-dialog-description"
        >
          Your session on this device will end. You can sign back in at any
          time.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="min-h-11 rounded-full bg-[var(--surface-strong)] px-5 py-2.5 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
            onClick={onClose}
            ref={cancelRef}
            type="button"
          >
            Cancel
          </button>
          <button
            className="min-h-11 rounded-full bg-rose-600 px-5 py-2.5 font-semibold text-sm text-white transition hover:bg-rose-500"
            onClick={async () => {
              await logout();
            }}
            type="button"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
