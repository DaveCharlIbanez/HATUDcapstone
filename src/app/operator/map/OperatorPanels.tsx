"use client";

import { ChatBubble } from "@/components/ChatBubble";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  type ActiveRideView,
  CurrentRidePanel,
  type RidePartner,
  type TripProgress,
} from "./CurrentRidePanel";
import { type DetailRide, RideDetailSheet } from "./RideDetailSheet";
import { RideQueueSheet } from "./RideQueueSheet";

/**
 * The driver's panels: the queue, the request being looked at, the ride that
 * is under way, and the chat.
 *
 * They are one component because they are one decision — which of them is on
 * screen — and the page that owns them is about the map, not about panels.
 */
export interface OperatorPanelsProps<TRide extends DetailRide> {
  /** How long the road takes, in seconds. */
  activeEtaSeconds: number | null;
  /** The ride that is under way, if there is one. */
  activeRide: ActiveRideView | null;
  /** The driver may take a request. */
  canAccept: boolean;
  /** The chat is open while a ride is live. */
  chatReady: boolean;
  /** The class for the detail panel — a sidebar or a sheet. */
  detailClassName: string;
  /** The request the driver is looking at. */
  detailRide: TRide | null;
  /** Whether the detail panel is a sidebar or a sheet. */
  detailVariant: "panel" | "sheet";
  /** How long the road takes to each open request, in seconds. */
  etas: Map<string, number>;
  onAccept: (rideId: Id<"rides">) => void;
  onCall: (phone: string) => void;
  onCloseDetail: () => void;
  onComplete: () => void;
  onSelectRequest: (ride: TRide) => void;
  onStartTrip: () => void;
  /** The passenger the driver is with. */
  partner: RidePartner | null;
  /** The requests waiting in the queue. */
  pendingRides: TRide[] | undefined;
  /** The class for the queue panel — a sidebar or a sheet. */
  queueClassName: string;
  /** The finished-ride card is up, so the queue makes way (fixoct48). */
  queueHidden?: boolean;
  /** Whether the queue is a sidebar or a sheet. */
  queueVariant: "panel" | "sheet";
  /** The request the queue is highlighting. */
  selectedRideId: Id<"rides"> | null;
  sessionToken: string | null;
  /** How far the simulated trip has got, once it has started. */
  tripProgress: TripProgress | null;
}

export function OperatorPanels<TRide extends DetailRide>({
  activeEtaSeconds,
  activeRide,
  canAccept,
  chatReady,
  detailRide,
  detailClassName,
  detailVariant,
  etas,
  onAccept,
  onCall,
  onCloseDetail,
  onComplete,
  onSelectRequest,
  onStartTrip,
  partner,
  pendingRides,
  queueClassName,
  queueHidden = false,
  queueVariant,
  selectedRideId,
  sessionToken,
  tripProgress,
}: OperatorPanelsProps<TRide>) {
  return (
    <>
      {/* The queue is hidden while a request is open, so the two sheets never
          occupy the same box on a phone and the same request is not listed
          twice. */}
      {!(activeRide || detailRide || queueHidden) && (
        <RideQueueSheet
          className={queueClassName}
          etas={etas}
          onSelect={onSelectRequest}
          pendingRides={pendingRides}
          selectedRideId={selectedRideId}
          variant={queueVariant}
        />
      )}

      {detailRide && !activeRide && (
        <RideDetailSheet
          canAccept={canAccept}
          className={detailClassName}
          etaSeconds={etas.get(detailRide._id) ?? null}
          onAccept={onAccept}
          onClose={onCloseDetail}
          ride={detailRide}
          variant={detailVariant}
        />
      )}

      {activeRide && (
        <CurrentRidePanel
          etaSeconds={activeEtaSeconds}
          onCall={onCall}
          onComplete={onComplete}
          onStartTrip={onStartTrip}
          partner={partner}
          ride={activeRide}
          tripProgress={tripProgress}
        />
      )}

      {chatReady && activeRide && sessionToken && (
        <ChatBubble
          partnerName={partner?.name ?? "Passenger"}
          partnerRole="commuter"
          positionOverride="bottom-40 right-4 md:bottom-32"
          rideId={activeRide._id}
          sessionToken={sessionToken}
        />
      )}
    </>
  );
}
