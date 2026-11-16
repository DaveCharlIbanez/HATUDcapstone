"use client";

import { FaArrowLeft } from "react-icons/fa";

interface BookingBackProps {
  /** The booking is in flight — the step cannot be left. */
  disabled?: boolean;
  /** Where the button goes, said plainly. */
  label: string;
  onBack: () => void;
}

/**
 * The way back out of a step of the booking.
 *
 * The booking sheet is a sequence of steps, and until the ride is created
 * every one of them can be left. There was no way to do that: the sheet could
 * only be dismissed, and dismissing threw the whole booking away. A rider who
 * picked a vehicle and then wanted a different one — or who reached the
 * payment method and wanted to change their mind about the vehicle — had to
 * start again from the map.
 *
 * The button names where it goes, so the rider is never guessing which of
 * the previous steps they will land on.
 */
export function BookingBack({
  disabled = false,
  label,
  onBack,
}: BookingBackProps) {
  return (
    <button
      className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-[var(--text-muted)] text-sm transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onBack}
      type="button"
    >
      <FaArrowLeft className="text-xs" />
      {label}
    </button>
  );
}
