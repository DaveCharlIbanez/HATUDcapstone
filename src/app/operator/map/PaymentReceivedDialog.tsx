"use client";

import { useEffect, useRef } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { trapFocus } from "@/lib/focusTrap";
import { paymentMethodLabel } from "@/lib/format";

/**
 * Tells the driver the passenger has paid (fixoct48).
 *
 * A GCash or Maya fare lands after the trip, while the driver may already be
 * looking at the queue. This pops up when it does, and the driver closes it.
 * Close, Escape and the backdrop all dismiss it; focus is trapped inside while
 * it is open and returned afterwards, as in `LogoutDialog`.
 */
export function PaymentReceivedDialog({
  fare,
  onClose,
  passengerName,
  paymentMethod,
}: {
  fare: number;
  onClose: () => void;
  passengerName?: string;
  paymentMethod?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const restore =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      trapFocus(event, panelRef.current);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restore?.focus();
    };
  }, [onClose]);

  const method = paymentMethodLabel(paymentMethod ?? "gcash");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        aria-label="Close the payment received dialog"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div
        aria-describedby="payment-received-description"
        aria-labelledby="payment-received-title"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-2xl"
        ref={panelRef}
        role="dialog"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/15 text-green-600 dark:text-green-400">
          <FaCheckCircle className="text-3xl" />
        </div>
        <h2
          className="mt-4 font-semibold text-[var(--foreground)] text-lg"
          id="payment-received-title"
        >
          Payment received
        </h2>
        <p
          className="mt-2 text-[var(--text-muted)] text-sm"
          id="payment-received-description"
        >
          {passengerName ?? "Your passenger"} paid{" "}
          <span className="font-semibold text-[var(--foreground)]">
            ₱{fare}
          </span>{" "}
          via {method}.
        </p>
        <button
          className="mt-6 w-full rounded-2xl bg-green-600 py-3 font-semibold text-sm text-white transition hover:bg-green-500"
          onClick={onClose}
          ref={closeRef}
          type="button"
        >
          Close
        </button>
      </div>
    </div>
  );
}
