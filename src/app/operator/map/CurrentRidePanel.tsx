"use client";

import { FaPhone } from "react-icons/fa";
import { DemoBadge } from "@/components/DemoBadge";
import { DragSheet, type SnapPoint } from "@/components/DragSheet";
import { formatEta, paymentMethodLabel } from "@/lib/format";
import { BOTTOM_NAV_HEIGHT } from "@/lib/layout";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { Id } from "../../../../convex/_generated/dataModel";

export interface ActiveRideView {
  _id: Id<"rides">;
  /**
   * When the passenger confirmed the pickup. Absent until they do, and the
   * driver cannot start the trip before then.
   */
  confirmedAt?: number;
  /** A demo trip, driven along the road by the server instead of GPS. */
  demoMode?: boolean;
  dropoff: { address: string };
  /** What the trip costs, and what the driver is collecting. */
  fare: number;
  /** How the passenger is paying for the trip. */
  paymentMethod?: string;
  pickup: { address: string };
  status: string;
}

/** How far the simulated trip has got. */
export interface TripProgress {
  /** The vehicle is at the destination, so the ride can be ended. */
  hasArrived: boolean;
  /** How much road is left, in metres. Null while the road is loading. */
  remainingMeters: number | null;
}

export interface RidePartner {
  name: string;
  phone: string;
}

interface CurrentRidePanelProps {
  /**
   * How long the road takes, in seconds.
   *
   * The router measures the road as it draws it, so this is the time the road
   * takes and not a guess.
   */
  etaSeconds: number | null;
  onCall: (phone: string) => void;
  onComplete: () => void;
  /** Starts the trip. Only enabled once the passenger has confirmed. */
  onStartTrip: () => void;
  partner: RidePartner | null;
  ride: ActiveRideView;
  /** How far the trip has got, once it has started. */
  tripProgress?: TripProgress | null;
}

/** Detents of the current ride sheet. */
const CURRENT_RIDE_SNAPS: SnapPoint[] = [
  { id: "peek", ratio: 0.5 },
  { id: "full", ratio: 1 },
  { id: "expanded", ratio: 1.5 },
];

function Summary({
  partner,
  ride,
}: {
  partner: RidePartner | null;
  ride: ActiveRideView;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-semibold text-[var(--foreground)] text-sm md:text-base">
        {partner?.name ?? "Loading..."}
      </p>
      <p className="line-clamp-1 text-[10px] text-[var(--text-muted)] md:text-sm">
        {ride.pickup.address} → {ride.dropoff.address}
      </p>
    </div>
  );
}

function Status({
  isAccepted,
  isDemo,
}: {
  isAccepted: boolean;
  isDemo: boolean;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {isDemo ? <DemoBadge /> : null}
      <StatusPill isAccepted={isAccepted} />
    </span>
  );
}

function StatusPill({ isAccepted }: { isAccepted: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 font-semibold text-[10px] md:px-3 md:py-1 md:text-xs ${
        isAccepted ? "bg-blue-600 text-white" : "bg-amber-400 text-amber-950"
      }`}
    >
      {isAccepted ? "ACCEPTED" : "IN PROGRESS"}
    </span>
  );
}

/**
 * What the driver is told, and what is still outstanding.
 *
 * A cash ride is settled by the driver, by the notes changing hands at the
 * drop-off. Everything else is settled by the passenger through their wallet
 * once the trip ends.
 */
function paymentNote(
  isAccepted: boolean,
  isCash: boolean,
  method: string | undefined
): string {
  if (isAccepted) {
    return "Waiting for the passenger to confirm.";
  }
  if (isCash) {
    return "Paid in cash — collect the fare at the drop-off.";
  }
  return `Paid by ${paymentMethodLabel(method)} after the trip.`;
}

/**
 * How long the road takes, said as a badge.
 */
function EtaBadge({
  isAccepted,
  seconds,
}: {
  isAccepted: boolean;
  seconds: number | null;
}) {
  const eta = formatEta(seconds);
  if (!eta) {
    return null;
  }
  return (
    // fixoct48: solid and bold, so the time is readable on the panel.
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 font-semibold text-[11px] text-white md:text-xs">
      {isAccepted ? `${eta} to the pickup` : `${eta} to the destination`}
    </span>
  );
}

function PaymentNote({
  etaSeconds,
  isAccepted,
  isCash,
  method,
}: {
  etaSeconds: number | null;
  isAccepted: boolean;
  isCash: boolean;
  method: string | undefined;
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 md:mt-3">
      <p className="text-[10px] text-[var(--text-muted)] md:text-xs">
        {paymentNote(isAccepted, isCash, method)}
      </p>
      <EtaBadge isAccepted={isAccepted} seconds={etaSeconds} />
    </div>
  );
}

/** How much road is left, said briefly. */
function distanceLeft(meters: number | null): string {
  if (meters === null) {
    return "Setting off…";
  }
  if (meters < 1000) {
    return `${Math.max(1, Math.round(meters))} m to go`;
  }
  return `${(meters / 1000).toFixed(1)} km to go`;
}

function Actions({
  fare,
  isAccepted,
  isCash,
  onCall,
  onComplete,
  onStartTrip,
  partner,
  passengerConfirmed,
  tripProgress,
}: {
  fare: number;
  isAccepted: boolean;
  isCash: boolean;
  onCall: (phone: string) => void;
  onComplete: () => void;
  onStartTrip: () => void;
  passengerConfirmed: boolean;
  partner: RidePartner | null;
  tripProgress: TripProgress | null;
}) {
  // A demo ride can only end at the destination. Until the vehicle is there
  // the button says how far is left instead — the server refuses an early
  // end either way. A live trip has no progress to wait for, so it can end
  // whenever the driver says it is over.
  const canComplete = tripProgress ? tripProgress.hasArrived : true;
  const completeLabel = isCash ? `Cash collected ₱${fare}` : "Complete";

  return (
    <div className="flex gap-1.5 md:gap-2">
      {partner?.phone && (
        <button
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-sky-600 px-2 py-1.5 text-white text-xs transition hover:bg-sky-500 md:gap-2 md:px-3 md:py-2.5 md:text-sm"
          onClick={() => onCall(partner.phone ?? "")}
          type="button"
        >
          <FaPhone className="text-[10px] md:text-xs" />
          Call
        </button>
      )}
      {isAccepted ? (
        // fixoct45: this button used to be grey but not `disabled`, so it
        // looked locked while still firing `onStartTrip`. It is now truly
        // disabled until the passenger confirms; the server refuses an early
        // start either way.
        <button
          aria-disabled={!passengerConfirmed}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-600 px-2 py-1.5 text-white text-xs transition hover:bg-green-500 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border disabled:border-[var(--border)] disabled:bg-[var(--surface-strong)] disabled:text-[var(--text-muted)] md:gap-2 md:px-3 md:py-2.5 md:text-sm"
          disabled={!passengerConfirmed}
          onClick={passengerConfirmed ? onStartTrip : undefined}
          title={
            passengerConfirmed
              ? undefined
              : "The passenger has to confirm the pickup first."
          }
          type="button"
        >
          {passengerConfirmed ? "Start trip" : "Waiting for passenger"}
        </button>
      ) : (
        // fixoct48: while the demo vehicle is still driving, the button reads
        // the distance left. It stays disabled, but the text is no longer
        // muted grey on grey: it is the driver's progress, and must be read.
        <button
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-600 px-2 py-1.5 text-white text-xs transition hover:bg-green-500 disabled:cursor-not-allowed disabled:border disabled:border-sky-500/60 disabled:bg-sky-500/15 disabled:font-semibold disabled:text-sky-800 md:gap-2 md:px-3 md:py-2.5 md:text-sm dark:disabled:text-sky-200"
          disabled={!canComplete}
          onClick={onComplete}
          type="button"
        >
          {canComplete
            ? completeLabel
            : distanceLeft(tripProgress?.remainingMeters ?? null)}
        </button>
      )}
    </div>
  );
}

export function CurrentRidePanel({
  ride,
  partner,
  etaSeconds,
  onCall,
  onStartTrip,
  onComplete,
  tripProgress = null,
}: CurrentRidePanelProps) {
  const isAccepted = ride.status === "accepted";
  const isCash = ride.paymentMethod === "cash";
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const actions = (
    <Actions
      fare={ride.fare}
      isAccepted={isAccepted}
      isCash={isCash}
      onCall={onCall}
      onComplete={onComplete}
      onStartTrip={onStartTrip}
      partner={partner}
      passengerConfirmed={ride.confirmedAt !== undefined}
      tripProgress={tripProgress}
    />
  );

  if (isDesktop) {
    return (
      <div className="absolute right-0 bottom-16 z-30 border-[var(--border)] border-t bg-[var(--surface)] p-3 md:bottom-0 md:p-4 md:p-6">
        <div className="mx-auto max-w-lg">
          <h3 className="mb-2 font-semibold text-[var(--foreground)] text-sm md:mb-3 md:text-base">
            Current Ride
          </h3>
          <div className="rounded-xl bg-[var(--surface-strong)] p-3 md:rounded-2xl md:p-4">
            <div className="mb-2 flex items-start justify-between gap-2 md:mb-3 md:flex-row">
              <Summary partner={partner} ride={ride} />
              <Status isAccepted={isAccepted} isDemo={ride.demoMode === true} />
            </div>
            <PaymentNote
              etaSeconds={etaSeconds}
              isAccepted={isAccepted}
              isCash={isCash}
              method={ride.paymentMethod}
            />
            {actions}
          </div>
        </div>
      </div>
    );
  }

  // On mobile the panel is a sheet. The route collapses to a single line and
  // the actions are pinned to the bottom, so they stay reachable when the
  // sheet is dragged down to its smallest size.
  return (
    <DragSheet
      bottomInset={BOTTOM_NAV_HEIGHT}
      className="absolute right-0 bottom-[var(--bottom-nav-height)] left-0 z-40 w-full bg-[var(--surface)]"
      defaultSnapId="full"
      footer={actions}
      handleLabel="Current ride panel"
      snaps={CURRENT_RIDE_SNAPS}
    >
      <div className="mx-auto max-w-lg px-3 pb-3">
        <h3 className="mb-2 font-semibold text-[var(--foreground)] text-sm">
          Current Ride
        </h3>
        <div className="rounded-xl bg-[var(--surface-strong)] p-3">
          <div className="flex items-start justify-between gap-2">
            <Summary partner={partner} ride={ride} />
            <Status isAccepted={isAccepted} isDemo={ride.demoMode === true} />
          </div>
          <PaymentNote
            etaSeconds={etaSeconds}
            isAccepted={isAccepted}
            isCash={isCash}
            method={ride.paymentMethod}
          />
        </div>
      </div>
    </DragSheet>
  );
}
