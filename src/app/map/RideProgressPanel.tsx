"use client";

import { DemoBadge } from "@/components/DemoBadge";
import { formatEta } from "@/lib/format";
import { CancelGrace } from "./CancelGrace";
import type { RideStatus } from "./rideStage";

export type { RideStatus } from "./rideStage";

export interface MatchedDriver {
  name: string;
  vehicleInfo: {
    model: string;
    plateNumber: string;
    color: string;
  };
}

/**
 * Where the driver has got to.
 *
 * `onTheWay` means the driver has just reported a position that is still a
 * street block away, so the trip cannot start yet — and the button that
 * starts it is disabled, with the reason said out loud.
 */
export type DriverArrival = "arrived" | "onTheWay" | "unknown";

interface RideProgressPanelProps {
  /**
   * When the passenger's 1-minute window to cancel an accepted ride closes,
   * or null when there is none (fixoct46).
   */
  cancelDeadline?: number | null;
  /** Where the driver is, as far as the passenger can tell. */
  driverArrival: DriverArrival;
  /**
   * How long the road takes, in seconds.
   *
   * The router measures the road as it draws it, so this is the time the road
   * takes and not a guess. It is null when there is no road yet.
   */
  etaSeconds: number | null;
  /** A demo trip: the server drives the vehicle, so the screen says so. */
  isDemo?: boolean;
  matchedOperator: MatchedDriver | null;
  onBookAnother: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  onPay: () => void;
  /** What the finished trip needs: paying for it, or rating the driver. */
  payActionLabel?: string;
  rideStatus: RideStatus;
  /** The vehicle has reached the destination, and the driver can end the trip. */
  tripArrived?: boolean;
}

/** What the passenger is told about the driver, and whether they can start. */
function arrivalCopy(arrival: DriverArrival): {
  blocked: boolean;
  text: string;
} {
  if (arrival === "arrived") {
    return {
      blocked: false,
      text: "Your driver is at your pickup point.",
    };
  }
  if (arrival === "onTheWay") {
    return {
      blocked: true,
      text: "Your driver is still on the way.",
    };
  }
  return {
    blocked: false,
    text: "Your driver is on the way. Confirm when they are with you.",
  };
}

/**
 * The time the road takes, said as a badge.
 */
function EtaBadge({ seconds }: { seconds: number | null }) {
  const eta = formatEta(seconds);
  if (!eta) {
    return null;
  }
  return (
    // fixoct48: solid and bold, so the time remaining is readable.
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-600 px-2.5 py-0.5 font-semibold text-white text-xs">
      {eta}
    </span>
  );
}

export function RideProgressPanel({
  cancelDeadline = null,
  rideStatus,
  driverArrival,
  etaSeconds,
  isDemo = false,
  matchedOperator,
  onCancel,
  onConfirm,
  onPay,
  onBookAnother,
  payActionLabel = "Pay & Rate Driver",
  tripArrived = false,
}: RideProgressPanelProps) {
  if (rideStatus === "searching") {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-sky-400 border-t-transparent" />
        <h3 className="mb-2 font-semibold text-[var(--foreground)] text-lg">
          Finding your driver
        </h3>
        <p className="mb-6 text-[var(--text-muted)]">
          Please wait while we match you with the best driver
        </p>
        <button
          className="w-full rounded-3xl bg-[var(--surface-strong)] py-3 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (rideStatus === "matched") {
    if (!matchedOperator) {
      return (
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-sky-400 border-t-transparent" />
          <h3 className="mb-2 font-semibold text-[var(--foreground)] text-lg">
            Driver found!
          </h3>
          <p className="text-[var(--text-muted)]">Loading driver details...</p>
        </div>
      );
    }

    const arrival = arrivalCopy(driverArrival);

    return (
      <div className="space-y-4">
        <h3 className="mb-6 flex items-center justify-center gap-2 text-center font-semibold text-[var(--foreground)] text-xl">
          Driver Assigned!
          {isDemo ? <DemoBadge /> : null}
        </h3>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface-strong)] text-3xl">
              🏍️
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[var(--foreground)] text-base">
                {matchedOperator.name}
              </div>
            </div>
          </div>
          <div className="space-y-2 border-[var(--border)] border-t pt-4 text-[var(--text-muted)] text-sm">
            <div className="flex justify-between">
              <span>Vehicle:</span>
              <span className="font-medium text-[var(--foreground)]">
                {matchedOperator.vehicleInfo.model}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Plate:</span>
              <span className="font-medium text-[var(--foreground)]">
                {matchedOperator.vehicleInfo.plateNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Color:</span>
              <span className="font-medium text-[var(--foreground)]">
                {matchedOperator.vehicleInfo.color}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p aria-live="polite" className="text-[var(--text-muted)] text-sm">
            {arrival.text}
          </p>
          <EtaBadge seconds={etaSeconds} />
        </div>

        <button
          className="w-full rounded-3xl bg-sky-500 py-3 font-semibold text-sm text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-muted)] disabled:shadow-none"
          disabled={arrival.blocked}
          onClick={onConfirm}
          type="button"
        >
          Confirm
        </button>

        <CancelGrace deadline={cancelDeadline} onCancel={onCancel} />
      </div>
    );
  }

  return (
    <div className="py-8 text-center">
      <h3 className="mb-4 flex items-center justify-center gap-2 font-semibold text-[var(--foreground)] text-lg">
        {rideStatus === "in-progress" && "Ride in progress"}
        {rideStatus === "completed" && "Ride completed"}
        {isDemo && rideStatus === "in-progress" ? <DemoBadge /> : null}
      </h3>

      {rideStatus === "in-progress" && tripArrived && (
        <p aria-live="polite" className="mb-4 text-[var(--text-muted)] text-sm">
          You have arrived. Your driver will end the trip.
        </p>
      )}

      {rideStatus === "in-progress" && !tripArrived && (
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="font-medium text-[var(--foreground)] text-sm">
            Time to your destination
          </span>
          <EtaBadge seconds={etaSeconds} />
        </div>
      )}

      {matchedOperator && (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-4">
            <div className="text-3xl">🏍️</div>
            <div className="text-left">
              <div className="font-medium text-[var(--foreground)]">
                {matchedOperator.name}
              </div>
              <div className="text-[var(--text-muted)] text-sm">
                {matchedOperator.vehicleInfo.model} •{" "}
                {matchedOperator.vehicleInfo.plateNumber}
              </div>
            </div>
          </div>
        </div>
      )}

      {rideStatus === "completed" && (
        <div className="space-y-3">
          <button
            className="w-full rounded-3xl bg-sky-500 py-3 font-semibold text-sm text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
            onClick={onPay}
            type="button"
          >
            {payActionLabel}
          </button>
          <button
            className="w-full rounded-3xl bg-[var(--surface-strong)] py-3 font-semibold text-[var(--foreground)] text-sm transition hover:bg-[var(--surface-muted)]"
            onClick={onBookAnother}
            type="button"
          >
            Book Another Ride
          </button>
        </div>
      )}
    </div>
  );
}
