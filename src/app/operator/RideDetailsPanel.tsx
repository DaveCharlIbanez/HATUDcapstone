"use client";

import { FaCheckCircle, FaPhone } from "react-icons/fa";
import type { Id } from "../../../convex/_generated/dataModel";

export interface RideRequestView {
  _id: Id<"rides">;
  commuter: { name: string; phone: string } | null;
  dropoff: { address: string; latitude: number; longitude: number };
  fare: number;
  pickup: { address: string; latitude: number; longitude: number };
  vehicleType?: string;
}

interface RideDetailsPanelProps {
  canAccept: boolean;
  onAccept: (rideId: Id<"rides">) => void;
  onCall: (phone: string) => void;
  onClose: () => void;
  ride: RideRequestView;
}

export function RideDetailsPanel({
  ride,
  canAccept,
  onAccept,
  onCall,
  onClose,
}: RideDetailsPanelProps) {
  return (
    <div className="absolute right-0 bottom-0 left-0 z-30 max-h-[70dvh] touch-pan-y overflow-y-auto overscroll-contain rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl md:absolute md:top-0 md:right-0 md:bottom-auto md:left-auto md:h-full md:max-h-none md:w-96 md:rounded-none md:border-t-0 md:border-l">
      {/* Drag handle — mobile only */}
      <div className="flex justify-center py-2 md:hidden">
        <div className="h-1.5 w-12 rounded-full bg-[var(--surface-muted)]" />
      </div>

      <div className="border-[var(--border)] border-b p-4 md:p-6">
        <h3 className="font-bold text-[var(--foreground)] text-xl">
          Ride Details
        </h3>
      </div>

      <div className="space-y-4 p-3 md:space-y-6 md:p-6">
        {/* Passenger Info */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-3 md:rounded-2xl md:p-4">
          <p className="mb-1 text-[10px] text-[var(--text-muted)] uppercase tracking-widest md:mb-2 md:text-xs">
            Passenger
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-[var(--foreground)] text-sm md:text-base">
                {ride.commuter?.name ?? "Unknown"}
              </p>
            </div>
            {ride.commuter?.phone && (
              <button
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-2.5 py-1.5 text-white text-xs transition hover:bg-sky-500 md:gap-2 md:px-3 md:py-2 md:text-sm"
                onClick={() =>
                  ride.commuter?.phone && onCall(ride.commuter.phone)
                }
                type="button"
              >
                <FaPhone className="text-[10px] md:text-sm" />
                <span className="hidden md:inline">Call</span>
              </button>
            )}
          </div>
        </div>

        {/* Location Info */}
        <div className="space-y-2 md:space-y-3">
          <div className="rounded-xl border border-[var(--border)] border-l-3 border-l-green-500 bg-[var(--surface-strong)]/50 p-3 md:rounded-2xl md:p-4">
            <p className="mb-1 text-[10px] text-[var(--text-muted)] uppercase tracking-widest md:mb-2 md:text-xs">
              Pickup
            </p>
            <p className="line-clamp-2 font-semibold text-[var(--foreground)] text-xs md:text-sm">
              {ride.pickup.address}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)] md:mt-1 md:text-xs">
              {ride.pickup.latitude.toFixed(4)},{" "}
              {ride.pickup.longitude.toFixed(4)}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] border-l-3 border-l-red-500 bg-[var(--surface-strong)]/50 p-3 md:rounded-2xl md:p-4">
            <p className="mb-1 text-[10px] text-[var(--text-muted)] uppercase tracking-widest md:mb-2 md:text-xs">
              Dropoff
            </p>
            <p className="line-clamp-2 font-semibold text-[var(--foreground)] text-xs md:text-sm">
              {ride.dropoff.address}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)] md:mt-1 md:text-xs">
              {ride.dropoff.latitude.toFixed(4)},{" "}
              {ride.dropoff.longitude.toFixed(4)}
            </p>
          </div>
        </div>

        {/* Vehicle & Fare */}
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]/50 p-2.5 text-center md:rounded-2xl md:p-3">
            <p className="mb-0.5 text-[10px] text-[var(--text-muted)] md:mb-1 md:text-xs">
              Vehicle
            </p>
            <p className="font-semibold text-[var(--foreground)] text-xs capitalize md:text-sm">
              {ride.vehicleType}
            </p>
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

        {/* Accept Button - Large and prominent */}
        <button
          className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-green-600 px-4 font-bold text-lg text-white transition hover:bg-green-500 hover:shadow-green-500/30 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]"
          disabled={!canAccept}
          onClick={() => onAccept(ride._id)}
          type="button"
        >
          <FaCheckCircle className="text-xl" />
          Accept Ride
        </button>

        <button
          className="w-full rounded-xl border border-[var(--border)] py-2 text-[var(--text-muted)] text-xs transition hover:text-[var(--foreground)] md:rounded-2xl md:py-2 md:text-sm"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>
    </div>
  );
}
