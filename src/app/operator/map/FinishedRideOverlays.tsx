"use client";

import { FinishedRidePanel } from "./FinishedRidePanel";
import { PaymentReceivedDialog } from "./PaymentReceivedDialog";
import type { useFinishedRide } from "./useFinishedRide";

/**
 * The finished-ride card and the payment popup (fixoct48).
 *
 * The card makes way for a new ride; the popup does not, because a payment
 * landing is worth telling the driver even mid-trip.
 */
export function FinishedRideOverlays({
  finished,
  hasActiveRide,
}: {
  finished: ReturnType<typeof useFinishedRide>;
  hasActiveRide: boolean;
}) {
  const { ride } = finished;
  if (!ride) {
    return null;
  }
  return (
    <>
      {finished.panelOpen && !hasActiveRide && (
        <FinishedRidePanel onDone={finished.closePanel} ride={ride} />
      )}
      {finished.dialogOpen && (
        <PaymentReceivedDialog
          fare={ride.fare}
          onClose={finished.closeDialog}
          passengerName={ride.passengerName}
          paymentMethod={ride.paymentMethod}
        />
      )}
    </>
  );
}
