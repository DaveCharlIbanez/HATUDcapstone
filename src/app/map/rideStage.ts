/**
 * Which stage the passenger's screen is in.
 *
 * This decision used to live inside a `useEffect` in `useRideStage`, where no
 * test could reach it. That is how a bug survived for long enough to be
 * reported from a phone: the server finished a ride, the client was told there
 * was no ride, and the screen stayed frozen on "Ride in progress" because
 * nothing had any way to notice.
 *
 * The rule is now a plain function, and the table below is the whole of it.
 */

export type BookingStep = "location" | "payment" | "booking" | "tracking";

export type RideStatus = "searching" | "matched" | "in-progress" | "completed";

export interface RideStage {
  /** What the panel says. */
  status: RideStatus;
  /** Which step of the booking screen is showing. */
  step: BookingStep;
}

export interface RideStageInput {
  /** The status of the ride, as the server has it. */
  status: string;
}

/**
 * The step a back button goes to.
 *
 * `null` when there is nowhere to go back to: the first step, and the steps
 * that belong to a ride that is under way. A ride that has been booked is
 * not a step — it is a trip somebody is on.
 */
export function backTargetFor(step: BookingStep): BookingStep | null {
  if (step === "payment") {
    return "location";
  }
  return null;
}

/**
 * What the back button says, for each step it can be on.
 *
 * It names where the button goes, so the rider is not left guessing which
 * of the previous steps they will land on.
 */
export const BACK_LABELS: Record<string, string> = {
  location: "Back to pickup and destination",
};

/**
 * The stage a ride in a given state puts the screen in.
 *
 * `null` means there is nothing to show: the ride was cancelled, or the status
 * is one this app does not know. The caller resets the booking in that case
 * rather than guessing.
 *
 * There is no "arriving" stage. The ride used to have one — the driver was
 * on the way, then they had arrived, and only then did the trip begin — but
 * it existed between the passenger's confirmation and the driver's own
 * "picked up" tap. The trip now begins with the passenger's confirmation, so
 * there is nothing between the two and the stage is gone. Where the driver
 * has got to is shown on the panel instead, and it does not change what the
 * stage is.
 */
export function stageForRide(input: RideStageInput): RideStage | null {
  const { status } = input;

  if (status === "pending") {
    return { status: "searching", step: "booking" };
  }

  if (status === "accepted") {
    return { status: "matched", step: "tracking" };
  }

  if (status === "inProgress") {
    return { status: "in-progress", step: "tracking" };
  }

  if (status === "completed") {
    return { status: "completed", step: "tracking" };
  }

  return null;
}
