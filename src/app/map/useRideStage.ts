"use client";

import { useEffect } from "react";
import type { Id } from "../../../convex/_generated/dataModel";

export type BookingStep = "location" | "vehicle" | "booking" | "tracking";
export type RideStatus =
  | "searching"
  | "matched"
  | "arriving"
  | "arrived"
  | "in-progress"
  | "completed";

interface ActiveRide {
  _id: Id<"rides">;
  status: string;
}

interface UseRideStageOptions {
  activeRide: ActiveRide | null | undefined;
  confirmedRide: boolean;
  resetBooking: () => void;
  setRideStatus: (status: RideStatus) => void;
  setStep: (step: BookingStep) => void;
}

/**
 * Keeps the booking screen in step with the state of the active ride.
 */
export function useRideStage({
  activeRide,
  confirmedRide,
  resetBooking,
  setStep,
  setRideStatus,
}: UseRideStageOptions): void {
  useEffect(() => {
    if (!activeRide) {
      return;
    }

    const status = activeRide.status;

    if (status === "pending") {
      setStep("booking");
      setRideStatus("searching");
      return;
    }

    if (status === "accepted") {
      if (confirmedRide) {
        setStep("tracking");
        setRideStatus("arriving");
      } else {
        setStep("booking");
        setRideStatus("matched");
      }
      return;
    }

    if (status === "inProgress") {
      setStep("tracking");
      setRideStatus("in-progress");
      return;
    }

    if (status === "completed") {
      setStep("tracking");
      setRideStatus("completed");
      return;
    }

    if (status === "cancelled") {
      resetBooking();
    }
  }, [activeRide, confirmedRide, resetBooking, setRideStatus, setStep]);
}
