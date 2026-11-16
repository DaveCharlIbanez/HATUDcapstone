"use client";

import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type {
  CommuterCounterpartView,
  OperatorCounterpartView,
} from "../../../convex/lib/projections";

export type ActivePartner =
  | ({ kind: "operator" } & OperatorCounterpartView)
  | ({ kind: "commuter" } & CommuterCounterpartView);

/** The shape `rides.getActiveForMe` returns for a passenger. */
export interface ActiveTrip {
  latestCompleted: Doc<"rides"> | null;
  partner: ActivePartner | null;
  ride: Doc<"rides"> | null;
}

export interface RiderView {
  /** The trip that has just finished and can still be paid for. */
  completedRide: Doc<"rides"> | null;
  /** The trip that is under way, if there is one. */
  liveRide: Doc<"rides"> | null;
  /** The driver the passenger is with. */
  matchedOperator: OperatorCounterpartView | null;
  /** The trip the screen is showing: the live one, or the last finished one. */
  viewedRide: Doc<"rides"> | null;
}

/**
 * Works out which ride the passenger's screen is about.
 *
 * A ride that has a driver always wins over one that does not, and the trip
 * that has just finished is kept so the passenger can pay for it and rate the
 * driver. The passenger is never shown the wrong one of the two.
 */
export function useRiderView(
  activeTrip: ActiveTrip | null | undefined,
  dismissedCompletedId: Id<"rides"> | null
): RiderView {
  const liveRide = activeTrip?.ride ?? null;
  const latestCompleted = activeTrip?.latestCompleted ?? null;

  const completedRide =
    latestCompleted && latestCompleted._id !== dismissedCompletedId
      ? latestCompleted
      : null;

  const viewedRide = liveRide ?? completedRide;

  const partner = activeTrip?.partner ?? null;
  const matchedOperator = partner?.kind === "operator" ? partner : null;

  return {
    completedRide,
    liveRide,
    matchedOperator,
    viewedRide,
  };
}
