"use client";

import { FaCheckCircle, FaClock, FaMapMarkerAlt } from "react-icons/fa";
import { DemoBadge } from "@/components/DemoBadge";
import { DragSheet, type SnapPoint } from "@/components/DragSheet";
import { formatEta, paymentMethodLabel } from "@/lib/format";
import { BOTTOM_NAV_HEIGHT } from "@/lib/layout";
import type { Id } from "../../../../convex/_generated/dataModel";

/** Detents of the ride detail sheet. */
const RIDE_DETAIL_SNAPS: SnapPoint[] = [
  { id: "peek", ratio: 0.35 },
  { id: "half", ratio: 0.7 },
  { id: "full", ratio: 1 },
  { id: "expanded", ratio: 1.6 },
];

/** The ride detail is a bottom sheet on mobile and a right sidebar on desktop. */
export function rideDetailPanel(isDesktop: boolean): {
  className: string;
  variant: "panel" | "sheet";
} {
  return isDesktop
    ? {
        className:
          "absolute right-0 bottom-0 left-0 z-30 overflow-y-auto overscroll-contain border-[var(--border)] border-l bg-[var(--surface)] md:bottom-auto md:left-auto md:top-0 md:w-96",
        variant: "panel",
      }
    : {
        className:
          "absolute right-0 bottom-[var(--bottom-nav-height)] left-0 z-50 w-full rounded-t-3xl bg-[var(--surface)]",
        variant: "sheet",
      };
}

/** One open request, as the driver sees it in the detail sheet. */
export interface DetailRide {
  _id: Id<"rides">;
  commuter: { name: string } | null;
  /** A demo trip: once it starts, the server drives it to the destination. */
  demoMode?: boolean;
  dropoff: { address: string; latitude: number; longitude: number };
  fare: number;
  /** How the passenger is paying. The driver has to know before accepting. */
  paymentMethod?: string;
  pickup: { address: string; latitude: number; longitude: number };
}

interface RideDetailSheetProps<TRide extends DetailRide> {
  canAccept: boolean;
  className: string;
  /** How long the road to this pickup takes, in seconds. */
  etaSeconds: number | null;
  onAccept: (rideId: Id<"rides">) => void;
  onClose: () => void;
  ride: TRide;
  variant: "panel" | "sheet";
}

/**
 * The open request the driver is looking at.
 *
 * The passenger is named and nothing else. Their number is shared once the
 * ride is accepted — it is the counterpart's number, not a directory of every
 * passenger in the deployment with an open request.
 */
export function RideDetailSheet<TRide extends DetailRide>({
  canAccept,
  className,
  etaSeconds,
  onAccept,
  onClose,
  ride,
  variant,
}: RideDetailSheetProps<TRide>) {
  return (
    <DragSheet
      bottomInset={BOTTOM_NAV_HEIGHT}
      className={className}
      defaultSnapId="half"
      dismissLabel="Ride details"
      handleLabel="Ride details panel"
      onDismiss={onClose}
      snaps={RIDE_DETAIL_SNAPS}
      variant={variant}
    >
      <div className="border-[var(--border)] border-b p-3 md:p-4 md:p-6">
        <h3 className="font-bold text-[var(--foreground)] text-lg md:text-xl">
          Ride Details
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-[var(--text-muted)] text-xs">
          <FaMapMarkerAlt className="text-[10px]" />
          The road to the pickup is drawn on your map.
        </p>
      </div>

      <div className="space-y-3 p-3 md:space-y-4 md:p-4 md:p-6">
        {/* Passenger */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-3 md:rounded-2xl md:p-4">
          <p className="mb-1 text-[10px] text-[var(--text-muted)] uppercase tracking-widest md:mb-2 md:text-xs">
            Passenger
          </p>
          <div className="flex items-center justify-between">
            <p className="font-semibold text-[var(--foreground)] text-sm md:text-base">
              {ride.commuter?.name ?? "Unknown"}
            </p>
            <span className="text-[10px] text-[var(--text-muted)] md:text-xs">
              Number shared on accept
            </span>
          </div>
        </div>

        {/* Locations */}
        <div className="space-y-2 md:space-y-3">
          <div className="rounded-xl border border-[var(--border)] border-l-3 border-l-green-500 bg-[var(--surface-strong)]/50 p-3 md:rounded-2xl md:p-4">
            <p className="mb-1 text-[10px] text-[var(--text-muted)] uppercase tracking-widest md:mb-1 md:text-xs">
              Pickup
            </p>
            <p className="line-clamp-2 font-semibold text-[var(--foreground)] text-xs md:text-sm">
              {ride.pickup.address}
            </p>
            {formatEta(etaSeconds) && (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-600 md:mt-1 md:text-xs dark:text-emerald-300">
                <FaClock className="text-[10px] md:text-xs" />
                {formatEta(etaSeconds)} away
              </p>
            )}
          </div>
          <div className="rounded-xl border border-[var(--border)] border-l-3 border-l-red-500 bg-[var(--surface-strong)]/50 p-3 md:rounded-2xl md:p-4">
            <p className="mb-1 text-[10px] text-[var(--text-muted)] uppercase tracking-widest md:mb-1 md:text-xs">
              Dropoff
            </p>
            <p className="line-clamp-2 font-semibold text-[var(--foreground)] text-xs md:text-sm">
              {ride.dropoff.address}
            </p>
          </div>
        </div>

        {/* How they are paying, and what it is */}
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-2.5 text-center md:rounded-2xl md:p-3">
            <p className="mb-0.5 text-[10px] text-[var(--text-muted)] md:mb-1 md:text-xs">
              Pays with
            </p>
            <p className="font-semibold text-[var(--foreground)] text-xs md:text-sm">
              {paymentMethodLabel(ride.paymentMethod)}
            </p>
            {ride.demoMode ? <DemoBadge className="mt-1" /> : null}
          </div>
          <div className="rounded-xl border border-sky-500 bg-sky-500/10 p-2.5 text-center md:rounded-2xl md:p-3">
            <p className="mb-0.5 text-[10px] text-[var(--text-muted)] md:mb-1 md:text-xs">
              Fare
            </p>
            <p className="font-bold text-base text-sky-400 md:text-xl">
              ₱{ride.fare}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 md:space-y-3">
          <button
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-600 px-3 py-2.5 font-semibold text-sm text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] md:gap-2 md:rounded-2xl md:px-4 md:py-3 md:text-base"
            disabled={!canAccept}
            onClick={() => onAccept(ride._id)}
            type="button"
          >
            <FaCheckCircle className="text-sm md:text-base" />
            Accept
          </button>
          <button
            className="w-full rounded-xl border border-[var(--border)] py-1.5 text-[var(--text-muted)] text-xs transition hover:text-[var(--foreground)] md:rounded-2xl md:py-2 md:text-sm"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </DragSheet>
  );
}
