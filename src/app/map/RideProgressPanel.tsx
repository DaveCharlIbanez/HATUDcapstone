"use client";

export type RideStatus =
  | "searching"
  | "matched"
  | "arriving"
  | "arrived"
  | "in-progress"
  | "completed";

export interface MatchedDriver {
  name: string;
  vehicleInfo: {
    model: string;
    plateNumber: string;
    color: string;
  };
}

interface RideProgressPanelProps {
  matchedOperator: MatchedDriver | null;
  onBookAnother: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  onPay: () => void;
  rideStatus: RideStatus;
}

export function RideProgressPanel({
  rideStatus,
  matchedOperator,
  onCancel,
  onConfirm,
  onPay,
  onBookAnother,
}: RideProgressPanelProps) {
  if (rideStatus === "searching") {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-sky-400 border-t-transparent" />
        <h3 className="mb-2 font-semibold text-lg text-white">
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
          <h3 className="mb-2 font-semibold text-lg text-white">
            Driver found!
          </h3>
          <p className="text-[var(--text-muted)]">Loading driver details...</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h3 className="mb-6 text-center font-semibold text-white text-xl">
          Driver Assigned!
        </h3>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface-strong)] text-3xl">
              🏍️
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-base text-white">
                {matchedOperator.name}
              </div>
            </div>
          </div>
          <div className="space-y-2 border-[var(--border)] border-t pt-4 text-[var(--text-muted)] text-sm">
            <div className="flex justify-between">
              <span>Vehicle:</span>
              <span className="font-medium text-white">
                {matchedOperator.vehicleInfo.model}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Plate:</span>
              <span className="font-medium text-white">
                {matchedOperator.vehicleInfo.plateNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Color:</span>
              <span className="font-medium text-white">
                {matchedOperator.vehicleInfo.color}
              </span>
            </div>
          </div>
        </div>

        <button
          className="w-full rounded-3xl bg-sky-500 py-3 font-semibold text-sm text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
          onClick={onConfirm}
          type="button"
        >
          Confirm &amp; Start Ride
        </button>
      </div>
    );
  }

  return (
    <div className="py-8 text-center">
      <h3 className="mb-4 font-semibold text-lg text-white">
        {rideStatus === "arriving" && "Driver is on the way"}
        {rideStatus === "arrived" && "Driver has arrived"}
        {rideStatus === "in-progress" && "Ride in progress"}
        {rideStatus === "completed" && "Ride completed"}
      </h3>

      {matchedOperator && (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-4">
            <div className="text-3xl">🏍️</div>
            <div className="text-left">
              <div className="font-medium text-white">
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
            Pay &amp; Rate Driver
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
