"use client";

import { FaPhone } from "react-icons/fa";
import type { Id } from "../../../../convex/_generated/dataModel";

export interface ActiveRideView {
  _id: Id<"rides">;
  dropoff: { address: string };
  pickup: { address: string };
  status: string;
}

export interface RidePartner {
  name: string;
  phone: string;
}

interface CurrentRidePanelProps {
  onCall: (phone: string) => void;
  onComplete: () => void;
  onPickedUp: () => void;
  partner: RidePartner | null;
  ride: ActiveRideView;
}

export function CurrentRidePanel({
  ride,
  partner,
  onCall,
  onPickedUp,
  onComplete,
}: CurrentRidePanelProps) {
  const isAccepted = ride.status === "accepted";

  return (
    <div className="absolute right-0 bottom-16 z-30 border-[var(--border)] border-t bg-[var(--surface)] p-3 md:bottom-0 md:p-4 md:p-6">
      <div className="mx-auto max-w-lg">
        <h3 className="mb-2 font-semibold text-[var(--foreground)] text-sm md:mb-3 md:text-base">
          Current Ride
        </h3>
        <div className="rounded-xl bg-[var(--surface-strong)] p-3 md:rounded-2xl md:p-4">
          <div className="mb-2 flex items-start justify-between gap-2 md:mb-3 md:flex-row">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--foreground)] text-sm md:text-base">
                {partner?.name ?? "Loading..."}
              </p>
              <p className="line-clamp-1 text-[10px] text-[var(--text-muted)] md:text-sm">
                {ride.pickup.address} → {ride.dropoff.address}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 font-semibold text-[10px] md:px-3 md:py-1 md:text-xs ${
                isAccepted
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}
            >
              {isAccepted ? "ACCEPTED" : "IN PROGRESS"}
            </span>
          </div>
          <div className="flex gap-1.5 md:gap-2">
            {partner?.phone && (
              <button
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-sky-600 px-2 py-1.5 text-white text-xs transition hover:bg-sky-500 md:gap-2 md:px-3 md:py-2.5 md:text-sm"
                onClick={() => onCall(partner.phone)}
                type="button"
              >
                <FaPhone className="text-[10px] md:text-xs" />
                Call
              </button>
            )}
            <button
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-600 px-2 py-1.5 text-white text-xs transition hover:bg-green-500 md:gap-2 md:px-3 md:py-2.5 md:text-sm"
              onClick={isAccepted ? onPickedUp : onComplete}
              type="button"
            >
              {isAccepted ? "Picked Up" : "Complete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
