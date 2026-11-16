"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { FaKey } from "react-icons/fa";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/authContext";
import { api } from "../../convex/_generated/api";

/**
 * Changes the password.
 *
 * The current password is asked for, so that nobody who finds a phone with the
 * app open can lock the owner out of their own account. Every other session on
 * the account is ended when the password changes.
 *
 * `embedded` drops the card frame and heading, for use inside a drop-down
 * that already has its own.
 */
export function ChangePasswordCard({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const { sessionToken } = useAuth();
  const { showToast } = useToast();
  const changePassword = useMutation(api.auth.changePassword);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!(sessionToken && currentPassword && newPassword)) {
      setError("Fill in every field");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await changePassword({
        currentPassword,
        newPassword,
        sessionToken,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Your password has been changed.", "success");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not change the password"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      className={
        embedded
          ? ""
          : "rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-5"
      }
    >
      <div className={embedded ? "hidden" : "flex items-center gap-3"}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
          <FaKey />
        </div>
        <div>
          <h2 className="font-semibold text-[var(--foreground)]">
            Change password
          </h2>
          <p className="text-[var(--text-muted)] text-sm">
            Your other sessions are signed out when it changes.
          </p>
        </div>
      </div>

      {embedded ? (
        <p className="text-[var(--text-muted)] text-sm">
          Your other sessions are signed out when it changes.
        </p>
      ) : null}

      <div className={embedded ? "mt-3 space-y-3" : "mt-4 space-y-3"}>
        <label
          className="block font-medium text-[var(--foreground)] text-sm"
          htmlFor="current-password"
        >
          Current password
        </label>
        <input
          autoComplete="current-password"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/50 px-4 py-3 text-[var(--foreground)] transition-colors placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          id="current-password"
          onChange={(event) => setCurrentPassword(event.target.value)}
          placeholder="Your current password"
          type="password"
          value={currentPassword}
        />

        <label
          className="block font-medium text-[var(--foreground)] text-sm"
          htmlFor="new-password"
        >
          New password
        </label>
        <input
          autoComplete="new-password"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/50 px-4 py-3 text-[var(--foreground)] transition-colors placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          id="new-password"
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="At least 8 characters, one capital and a number"
          type="password"
          value={newPassword}
        />

        <label
          className="block font-medium text-[var(--foreground)] text-sm"
          htmlFor="confirm-password"
        >
          Confirm new password
        </label>
        <input
          autoComplete="new-password"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/50 px-4 py-3 text-[var(--foreground)] transition-colors placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          id="confirm-password"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Type it again"
          type="password"
          value={confirmPassword}
        />
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-500 text-sm">
          {error}
        </p>
      ) : null}

      <button
        className="mt-4 w-full rounded-xl bg-sky-500 py-3 font-semibold text-white shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSaving}
        onClick={handleSubmit}
        type="button"
      >
        {isSaving ? "Changing…" : "Change password"}
      </button>
    </section>
  );
}
