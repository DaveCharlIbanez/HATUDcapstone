/**
 * When a passenger may cancel their own ride (fixoct46).
 *
 * - While the ride is still `pending` (no driver yet), they may always cancel.
 * - Once a driver accepts, they have a one-minute grace period. After that the
 *   driver is already on the way, and the cancel button is disabled.
 * - Once the trip is under way, or finished, they cannot cancel.
 *
 * It is a pure function so the server (which enforces it) and the passenger's
 * screen (which explains it) use the same rule and the same number.
 */

/** How long after a driver accepts the passenger may still cancel. */
export const COMMUTER_CANCEL_GRACE_MS = 60_000;

export interface CancellableRide {
  /** When a driver accepted the ride. Absent on rides accepted before fixoct46. */
  acceptedAt?: number;
  status: string;
}

/**
 * When the passenger's grace period ends, or null when there is none.
 *
 * A ride accepted before `acceptedAt` existed has no start for its window, and
 * is treated as closed rather than guessed from `updatedAt`, which every
 * location ping bumps.
 */
export function commuterCancelDeadline(ride: CancellableRide): number | null {
  if (ride.status !== "accepted" || ride.acceptedAt === undefined) {
    return null;
  }
  return ride.acceptedAt + COMMUTER_CANCEL_GRACE_MS;
}

/** Whether the passenger may cancel this ride right now. */
export function commuterCanCancel(
  ride: CancellableRide,
  now: number = Date.now()
): boolean {
  if (ride.status === "pending") {
    return true;
  }
  const deadline = commuterCancelDeadline(ride);
  return deadline !== null && now < deadline;
}
