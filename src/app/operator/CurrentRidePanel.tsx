"use client";

import { FaPhone } from "react-icons/fa";

export interface ActiveRideView {
  _id: string;
  dropoff: { address: string };
  pickup: { address: string };
  status: string;
}

export interface RidePartner {
  name: string;
  phone: string;
}

interface CurrentRidePanelProps {
  activeRide: ActiveRideView;
  onCall: (phone: string) => void;
  onComplete: () => void;
  onPickedUp: () => void;
  partner: RidePartner | null;
  statusClassName: (status: string) => string;
  statusLabels: Record<string, string>;
}

export function CurrentRidePanel({
  activeRide,
  partner,
  statusLabels,
  statusClassName,
  onCall,
  onPickedUp,
  onComplete,
}: CurrentRidePanelProps) {
  return (
    <div className="absolute right-0 bottom-20 border-[var(--border)] border-t-2 bg-[var(--surface)] p-4 md:bottom-0 md:p-6">
      <div className="mx-auto max-w-md">
        <h3 className="mb-2 font-semibold text-[var(--foreground)] text-sm md:mb-4 md:text-lg">
          Current Ride
        </h3>

        <div className="rounded-xl bg-[var(--surface-strong)] p-3 md:mb-4 md:rounded-2xl md:p-4">
          <div className="mb-2 flex items-start justify-between gap-2 md:mb-3 md:flex-row">
            <div className="min-w-0">
              <p className="font-semibold text-[var(--foreground)] text-sm md:text-base">
                {partner?.name ?? "Loading..."}
              </p>
              <p className="line-clamp-1 text-[10px] text-[var(--text-muted)] md:text-sm">
                {activeRide.pickup.address} → {activeRide.dropoff.address}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 font-semibold text-[10px] md:px-3 md:py-1 md:text-xs ${statusClassName(
                activeRide.status
              )}`}
            >
              {statusLabels[activeRide.status] ??
                activeRide.status.toUpperCase()}
            </span>
          </div>

          <div className="flex gap-3">
            {partner?.phone && (
              <button
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-sky-500/50 bg-sky-600 px-4 font-semibold text-white transition hover:bg-sky-500"
                onClick={() => onCall(partner.phone)}
                type="button"
              >
                <FaPhone className="text-base" />
                Call
              </button>
            )}
            <button
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-green-500/50 bg-green-600 px-4 font-semibold text-white transition hover:bg-green-500"
              onClick={
                activeRide.status === "accepted" ? onPickedUp : onComplete
              }
              type="button"
            >
              {activeRide.status === "accepted" ? "Picked Up" : "Complete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
