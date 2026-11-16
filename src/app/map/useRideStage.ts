"use client";

import { useEffect } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { type BookingStep, type RideStatus, stageForRide } from "./rideStage";

export type { BookingStep, RideStatus } from "./rideStage";

interface ActiveRide {
  _id: Id<"rides">;
  status: string;
}

interface UseRideStageOptions {
  activeRide: ActiveRide | null | undefined;
  /** The passenger tapped "Confirm" and the server has not caught up yet. */
  confirmedRideId: Id<"rides"> | null;
  resetBooking: () => void;
  setRideStatus: (status: RideStatus) => void;
  setStep: (step: BookingStep) => void;
}

/**
 * Keeps the booking screen in step with the state of the active ride.
 *
 * The stage is derived from the server, not from a local flag. The passenger's
 * confirmation used to be a local boolean that never reached the server, so
 * the screen and the ride could say different things about the same trip.
 *
 * The decision itself is in `stageForRide`, where it can be tested.
 */
export function useRideStage({
  activeRide,
  confirmedRideId,
  resetBooking,
  setRideStatus,
  setStep,
}: UseRideStageOptions): void {
  useEffect(() => {
    if (!activeRide) {
      return;
    }

    // The passenger has just tapped "Confirm" and the server has not caught
    // up yet. The trip has started, so the screen says so.
    if (
      confirmedRideId === activeRide._id &&
      activeRide.status === "accepted"
    ) {
      setStep("tracking");
      setRideStatus("in-progress");
      return;
    }

    const stage = stageForRide({ status: activeRide.status });

    if (!stage) {
      // A cancelled ride, or a status this app does not know. There is
      // nothing to show, so the booking is cleared rather than guessed at.
      if (activeRide.status === "cancelled") {
        resetBooking();
      }
      return;
    }

    setStep(stage.step);
    setRideStatus(stage.status);
  }, [activeRide, confirmedRideId, resetBooking, setRideStatus, setStep]);
}
