"use client";

import { FaCheckCircle, FaClock, FaExclamationTriangle } from "react-icons/fa";
import { DemoBadge } from "@/components/DemoBadge";
import { paymentMethodLabel } from "@/lib/format";
import type { Settlement } from "../../../../convex/lib/settlement";

/**
 * The ride the driver has just finished (fixoct48).
 *
 * It mirrors the passenger's "Ride completed" card: the trip is over, and the
 * one thing left is the fare. A cash fare was collected at the drop-off; a
 * GCash or Maya fare is paid by the passenger afterwards, and until it lands
 * the driver is told it is awaited.
 */
export interface FinishedRideView {
  demoMode?: boolean;
  dropoffAddress: string;
  fare: number;
  passengerName?: string;
  paymentMethod?: string;
  pickupAddress: string;
  settlement: Settlement;
}

function SettlementRow({ ride }: { ride: FinishedRideView }) {
  const method = paymentMethodLabel(ride.paymentMethod ?? "gcash");
  if (ride.settlement === "awaitingPayment") {
    return (
      <div
        aria-live="polite"
        className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-2.5 text-amber-800 text-sm dark:text-amber-200"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
        <FaClock aria-hidden className="shrink-0" />
        <span className="font-semibold">
          Awaiting payment via {method} · ₱{ride.fare}
        </span>
      </div>
    );
  }
  if (ride.settlement === "failed") {
    return (
      <div
        aria-live="polite"
        className="flex items-center gap-2 rounded-xl border border-rose-500/50 bg-rose-500/15 px-3 py-2.5 text-rose-700 text-sm dark:text-rose-200"
      >
        <FaExclamationTriangle aria-hidden className="shrink-0" />
        <span className="font-semibold">
          {method} payment failed — waiting for the passenger to try again
        </span>
      </div>
    );
  }
  return (
    <div
      aria-live="polite"
      className="flex items-center gap-2 rounded-xl border border-green-600/70 bg-green-500/25 px-3 py-2.5 text-green-950 text-sm dark:text-green-50"
    >
      <FaCheckCircle
        aria-hidden
        className="shrink-0 text-green-700 dark:text-green-300"
      />
      <span className="font-semibold">
        {ride.settlement === "cashCollected"
          ? `Cash collected · ₱${ride.fare}`
          : `Payment received via ${method} · ₱${ride.fare}`}
      </span>
    </div>
  );
}

export function FinishedRidePanel({
  onDone,
  ride,
}: {
  /** The driver is finished with the card and goes back to the queue. */
  onDone: () => void;
  ride: FinishedRideView;
}) {
  const awaiting =
    ride.settlement === "awaitingPayment" || ride.settlement === "failed";

  return (
    <div className="absolute right-0 bottom-[var(--bottom-nav-height)] left-0 z-40 border-[var(--border)] border-t bg-[var(--surface)] p-3 md:bottom-0 md:left-auto md:w-full md:p-6">
      <div className="mx-auto max-w-lg">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-[var(--foreground)] text-base md:mb-3">
          Ride completed
          {ride.demoMode ? <DemoBadge /> : null}
        </h3>
        <div className="space-y-3 rounded-xl bg-[var(--surface-strong)] p-3 md:rounded-2xl md:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--foreground)] text-sm md:text-base">
                {ride.passengerName ?? "Passenger"}
              </p>
              <p className="line-clamp-1 text-[var(--text-muted)] text-xs md:text-sm">
                {ride.pickupAddress} → {ride.dropoffAddress}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-green-600 px-2 py-0.5 font-semibold text-[10px] text-white md:px-3 md:py-1 md:text-xs">
              COMPLETED
            </span>
          </div>
          <SettlementRow ride={ride} />
          {awaiting ? (
            <p className="text-[var(--text-muted)] text-xs">
              You will be notified here when the passenger pays.
            </p>
          ) : null}
          <button
            className="w-full rounded-lg bg-sky-600 px-3 py-2.5 font-semibold text-sm text-white transition hover:bg-sky-500"
            onClick={onDone}
            type="button"
          >
            {awaiting ? "Back to ride queue" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
