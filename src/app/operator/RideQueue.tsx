"use client";

import type { Id } from "../../../convex/_generated/dataModel";

export interface PendingRideView {
  _id: Id<"rides">;
  commuter: { name: string; phone: string } | null;
  dropoff: { address: string; latitude: number; longitude: number };
  fare: number;
  pickup: { address: string; latitude: number; longitude: number };
  vehicleType?: string;
}

interface RideQueueProps<T extends PendingRideView> {
  onSelect: (ride: T) => void;
  rides: T[] | undefined;
}

export function RideQueue<T extends PendingRideView>({
  rides,
  onSelect,
}: RideQueueProps<T>) {
  return (
    <div className="absolute right-0 bottom-20 left-0 z-20 max-h-[55dvh] touch-pan-y overflow-y-auto overscroll-contain border-[var(--border)] border-t-2 bg-[var(--surface)] md:top-32 md:right-auto md:bottom-0 md:left-0 md:h-full md:max-h-none md:w-80 md:rounded-none md:border-t-0 md:border-r">
      {/* Mobile drag handle - larger */}
      <div className="flex justify-center py-3 md:hidden">
        <div className="h-2 w-16 rounded-full bg-[var(--surface-muted)]" />
      </div>

      <div className="border-[var(--border)] border-b p-4 md:p-6">
        <h2 className="font-bold text-[var(--foreground)] text-xl md:text-2xl">
          Available Rides
        </h2>
        <p className="mt-1 text-[var(--text-muted)] text-sm md:mt-1 md:text-sm">
          {rides === undefined ? "Loading..." : `${rides.length} waiting`}
        </p>
      </div>

      <div className="space-y-3 p-3 md:space-y-3 md:p-4">
        {rides === undefined && (
          <div className="py-6 text-center text-[var(--text-muted)] text-sm md:py-8 md:text-sm">
            Loading rides...
          </div>
        )}
        {rides?.length === 0 && (
          <div className="py-6 text-center text-[var(--text-muted)] text-sm md:py-8 md:text-sm">
            No rides available
          </div>
        )}
        {rides?.map((ride) => (
          <button
            className={`w-full rounded-2xl border-2 p-4 text-left transition ${
              ride?._id === ride._id
                ? "border-sky-400 bg-sky-500/20 shadow-lg shadow-sky-500/20"
                : "border-[var(--border)] bg-[var(--surface-strong)]/70 hover:border-sky-500/50 hover:bg-[var(--surface-strong)]"
            }`}
            key={ride._id}
            onClick={() => onSelect(ride)}
            type="button"
          >
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="font-bold text-[var(--foreground)] text-base">
                  {ride.commuter?.name ?? "Unknown"}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[var(--text-muted)] text-xs">
                  <span className="rounded-full bg-[var(--surface-muted)] px-2 py-1 capitalize">
                    {ride.vehicleType}
                  </span>
                </div>
              </div>
              <span className="font-bold text-sky-400 text-xl">
                ₱{ride.fare}
              </span>
            </div>

            <div className="space-y-2 text-[var(--foreground)] text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-500 text-lg">📍</span>
                <span className="truncate">{ride.pickup.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg text-red-500">📌</span>
                <span className="truncate">{ride.dropoff.address}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
