"use client";

import { DemoBadge } from "@/components/DemoBadge";
import { DragSheet, type SnapPoint } from "@/components/DragSheet";
import { formatEta, paymentMethodLabel } from "@/lib/format";
import { BOTTOM_NAV_HEIGHT } from "@/lib/layout";
import type { Id } from "../../../../convex/_generated/dataModel";

/** Detents of the ride queue sheet. */
const RIDE_LIST_SNAPS: SnapPoint[] = [
  { id: "peek", ratio: 0.35 },
  { id: "half", ratio: 0.7 },
  { id: "full", ratio: 1 },
  { id: "expanded", ratio: 1.6 },
];

/** The ride queue is a bottom sheet on mobile and a left sidebar on desktop. */
export function rideListPanel(isDesktop: boolean): {
  className: string;
  variant: "panel" | "sheet";
} {
  return isDesktop
    ? {
        className:
          "absolute top-16 bottom-0 left-0 z-20 w-80 overflow-y-auto overscroll-contain border-[var(--border)] border-r bg-[var(--surface)] lg:top-20",
        variant: "panel",
      }
    : {
        className:
          "absolute right-0 bottom-[var(--bottom-nav-height)] left-0 z-40 w-full rounded-t-3xl bg-[var(--surface)]",
        variant: "sheet",
      };
}

/** One open request, as the driver sees it in the queue. */
export interface QueueRide {
  _id: Id<"rides">;
  commuter: { name: string } | null;
  /** A demo trip. The driver should know before accepting. */
  demoMode?: boolean;
  dropoff: { address: string };
  fare: number;
  /** How the passenger is paying. The driver has to know before accepting. */
  paymentMethod?: string;
  pickup: { address: string };
}

interface RideQueueSheetProps<TRide extends QueueRide> {
  className: string;
  /**
   * How long the road takes to each open request, in seconds.
   *
   * A request that has not been measured yet is simply absent, so the queue
   * shows no time rather than a made-up one.
   */
  etas: Map<string, number>;
  onSelect: (ride: TRide) => void;
  pendingRides: TRide[] | undefined;
  selectedRideId: Id<"rides"> | null;
  variant: "panel" | "sheet";
}

/**
 * The requests a driver can take.
 *
 * The passenger is named, and nothing else. Their number belongs to a
 * counterpart on a ride the driver has accepted, not to every passenger in the
 * deployment who happens to have a request open.
 */
export function RideQueueSheet<TRide extends QueueRide>({
  className,
  etas,
  onSelect,
  pendingRides,
  selectedRideId,
  variant,
}: RideQueueSheetProps<TRide>) {
  return (
    <DragSheet
      bottomInset={BOTTOM_NAV_HEIGHT}
      className={className}
      defaultSnapId="full"
      dismissLabel="Ride queue"
      handleLabel="Ride queue panel"
      snaps={RIDE_LIST_SNAPS}
      variant={variant}
    >
      <div className="border-[var(--border)] border-b p-3 md:p-4 md:p-6">
        <h2 className="font-bold text-[var(--foreground)] text-lg md:text-xl lg:text-2xl">
          Available
        </h2>
        <p className="mt-0.5 text-[var(--text-muted)] text-xs md:mt-1 md:text-sm">
          {pendingRides === undefined
            ? "Loading..."
            : `${pendingRides.length} waiting`}
        </p>
      </div>

      <div className="space-y-2 p-2 md:space-y-3 md:p-3 md:p-4">
        {pendingRides?.length === 0 && (
          <p className="py-4 text-center text-[var(--text-muted)] text-xs md:py-8 md:text-sm">
            No rides available
          </p>
        )}
        {pendingRides?.map((ride) => (
          <button
            className={`w-full rounded-xl border p-3 text-left transition md:rounded-2xl md:p-4 ${
              selectedRideId === ride._id
                ? "border-sky-500 bg-sky-500/10"
                : "border-[var(--border)] bg-[var(--surface-strong)]/50 hover:bg-[var(--surface-strong)]"
            }`}
            key={ride._id}
            onClick={() => onSelect(ride)}
            type="button"
          >
            <div className="mb-1 flex items-start justify-between md:mb-2">
              <div>
                <p className="font-semibold text-[var(--foreground)] text-sm md:text-base">
                  {ride.commuter?.name ?? "Unknown"}
                </p>
                <span className="mt-0.5 ml-1 inline-block rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-600 md:mt-1 md:px-2 md:text-xs dark:text-sky-300">
                  {paymentMethodLabel(ride.paymentMethod)}
                </span>
                {ride.demoMode ? <DemoBadge className="mt-0.5 ml-1" /> : null}
                {formatEta(etas.get(ride._id)) && (
                  <span className="mt-0.5 ml-1 inline-block rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-600 md:mt-1 md:px-2 md:text-xs dark:text-emerald-300">
                    {formatEta(etas.get(ride._id))}
                  </span>
                )}
              </div>
              <span className="font-bold text-base text-sky-400 md:text-lg">
                ₱{ride.fare}
              </span>
            </div>

            <div className="space-y-1 text-[var(--foreground)] text-xs md:space-y-1.5 md:text-sm">
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-green-500 text-sm md:text-base">📍</span>
                <span className="truncate">{ride.pickup.address}</span>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-red-500 text-sm md:text-base">📌</span>
                <span className="truncate">{ride.dropoff.address}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </DragSheet>
  );
}
