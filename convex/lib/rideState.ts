import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isElectronic, methodOf } from "./paymentMethods";

/**
 * The lifecycle of a ride, in one place.
 *
 * Two descriptions of the lifecycle used to live apart and could disagree: the
 * list of statuses that count as "live", and the rules about which status may
 * follow which. Because nothing checked the status a ride was coming from, a
 * driver could move a ride from `accepted` straight to `completed` — skipping
 * the trip entirely — and the status a ride was left in after a driver went
 * offline was a matter of which mutation happened to run last.
 *
 * The table below is now the only description of the lifecycle, and every
 * mutation that writes a status goes through it.
 */

export type RideStatus =
  | "pending"
  | "accepted"
  | "inProgress"
  | "completed"
  | "cancelled";

/** The statuses a ride holds while it still needs a driver or a passenger. */
export const LIVE_STATUSES: RideStatus[] = [
  "pending",
  "accepted",
  "inProgress",
];

/** The statuses that mean a driver is on the job right now. */
export const ON_JOB_STATUSES: RideStatus[] = ["accepted", "inProgress"];

/**
 * Where a ride may legally go next.
 *
 * `completed` and `cancelled` are terminal. A finished trip does not
 * un-finish, and a cancelled request does not come back to life.
 */
const TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  pending: ["accepted", "cancelled"],
  accepted: ["inProgress", "cancelled"],
  inProgress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** True when the ride may move from `from` to `to`. */
export function canTransition(from: RideStatus, to: RideStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** True when the status means the ride still needs a driver or a passenger. */
export function isLive(status: RideStatus): boolean {
  return LIVE_STATUSES.includes(status);
}

/** True when the status means a driver is on the job right now. */
export function isOnJob(status: RideStatus): boolean {
  return ON_JOB_STATUSES.includes(status);
}

/**
 * True when the driver is holding a ride they still have to finish.
 *
 * This is derived from the rides table rather than stored on the driver, so it
 * cannot drift out of step with the rides themselves.
 */
export async function hasLiveRide(
  ctx: QueryCtx,
  operatorId: Id<"operators">
): Promise<boolean> {
  const rides = await ctx.db
    .query("rides")
    .withIndex("by_operatorId", (q) => q.eq("operatorId", operatorId))
    .collect();
  return rides.some((ride) => isOnJob(ride.status));
}

/**
 * The passenger's live ride.
 *
 * A ride that has a driver always wins over one that does not. The passenger
 * has to be shown the driver who is on the way, even when a newer request is
 * still sitting in the queue — otherwise the passenger watches a driver drive
 * to their pickup point while their own screen says "Finding your driver".
 */
export async function findActiveCommuterRide(
  ctx: QueryCtx,
  commuterId: Id<"commuters">
) {
  const rides = await ctx.db
    .query("rides")
    .withIndex("by_commuterId", (q) => q.eq("commuterId", commuterId))
    .order("desc")
    .collect();

  const matched = rides.find(
    (r) => r.status === "accepted" || r.status === "inProgress"
  );
  if (matched) {
    return matched;
  }

  return rides.find((r) => r.status === "pending") ?? null;
}

/**
 * The driver's live ride.
 *
 * `inProgress` wins over `accepted`: a driver who is on the road is on the
 * ride that is under way, not on the one they accepted earlier.
 */
export async function findActiveOperatorRide(
  ctx: QueryCtx,
  operatorId: Id<"operators">
) {
  const rides = await ctx.db
    .query("rides")
    .withIndex("by_operatorId", (q) => q.eq("operatorId", operatorId))
    .order("desc")
    .collect();

  const underWay = rides.find((r) => r.status === "inProgress");
  if (underWay) {
    return underWay;
  }

  return rides.find((r) => r.status === "accepted") ?? null;
}

/**
 * The passenger's completed rides, newest first.
 */
export async function findCompletedCommuterRides(
  ctx: QueryCtx,
  commuterId: Id<"commuters">
): Promise<Doc<"rides">[]> {
  const rides = await ctx.db
    .query("rides")
    .withIndex("by_commuterId", (q) => q.eq("commuterId", commuterId))
    .order("desc")
    .collect();
  return rides.filter((ride) => ride.status === "completed");
}

/**
 * Whether the ride has been rated.
 */
export async function isRideRated(
  ctx: QueryCtx,
  rideId: Id<"rides">
): Promise<boolean> {
  const feedback = await ctx.db
    .query("feedback")
    .withIndex("by_rideId", (q) => q.eq("rideId", rideId))
    .first();
  return feedback !== null;
}

/**
 * Whether the ride still owes money through the app.
 *
 * A cash ride is settled by a handover with the driver, so it never appears
 * as an outstanding balance and never sends the passenger to the payment
 * page to pay cash through it. It is the driver's business, and the driver
 * confirms it.
 */
export function rideOwesPayment(ride: Doc<"rides">): boolean {
  if (ride.paymentStatus === "paid") {
    return false;
  }
  return isElectronic(methodOf(ride.paymentMethod));
}

/**
 * How long after a trip ends the passenger is asked to rate it.
 *
 * Rating is optional. The prompt is for the trip somebody has just taken;
 * a trip from last week that was never rated is not something to nag about.
 */
export const RATING_PROMPT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the passenger should still be asked to rate this ride.
 *
 * Asked once: not after it has been rated, not after the passenger chose to
 * skip it, and not once the trip is more than a day old.
 */
export async function rideNeedsRating(
  ctx: QueryCtx,
  ride: Doc<"rides">,
  now: number
): Promise<boolean> {
  if (ride.ratingDismissedAt !== undefined) {
    return false;
  }
  if (ride.completedAt === undefined) {
    return false;
  }
  if (now - ride.completedAt > RATING_PROMPT_WINDOW_MS) {
    return false;
  }
  return !(await isRideRated(ctx, ride._id));
}

/**
 * Whether the ride still needs something from the passenger — paying for it,
 * rating the driver, or both.
 *
 * Paying is required. Rating is optional and asked once (see
 * `rideNeedsRating`).
 */
export async function rideNeedsAttention(
  ctx: QueryCtx,
  ride: Doc<"rides">,
  now: number
): Promise<boolean> {
  if (rideOwesPayment(ride)) {
    return true;
  }
  return await rideNeedsRating(ctx, ride, now);
}

/** How many finished trips are looked at when hunting for an unpaid one. */
const ATTENTION_SCAN_LIMIT = 10;

/**
 * How long after a trip ends it still greets the passenger on the map.
 *
 * A trip that finished half an hour ago is not what somebody wants to see
 * when they open the app. It stays on the dashboard, where the things waiting
 * for them belong, and the map goes back to being the booking screen.
 */
export const RECENTLY_COMPLETED_WINDOW_MS = 30 * 60 * 1000;

/**
 * The finished trip that still needs something from the passenger.
 *
 * An unpaid trip is looked for across the recent trips, because money owed
 * must not disappear. A rating is only ever asked for the newest trip, so
 * rating or skipping one never uncovers an older one behind it.
 *
 * It is the same trip the map, the payment page and the rating page all
 * work on.
 */
export async function findTripNeedingAttention(
  ctx: QueryCtx,
  commuterId: Id<"commuters">,
  now: number
): Promise<Doc<"rides"> | null> {
  const completed = await findCompletedCommuterRides(ctx, commuterId);

  const unpaid = completed
    .slice(0, ATTENTION_SCAN_LIMIT)
    .find((ride) => rideOwesPayment(ride));
  if (unpaid) {
    return unpaid;
  }

  const newest = completed[0];
  if (newest && (await rideNeedsRating(ctx, newest, now))) {
    return newest;
  }
  return null;
}

/**
 * The finished trip the passenger has just come back from.
 *
 * A trip that ended a long time ago is not what should greet somebody when
 * they open the app, so the map only carries the recent one. The trip itself
 * is not lost — the dashboard still has it.
 */
export async function findRecentTripNeedingAttention(
  ctx: QueryCtx,
  commuterId: Id<"commuters">,
  now: number
): Promise<Doc<"rides"> | null> {
  const trip = await findTripNeedingAttention(ctx, commuterId, now);
  if (!trip || trip.completedAt === undefined) {
    return null;
  }
  if (now - trip.completedAt > RECENTLY_COMPLETED_WINDOW_MS) {
    return null;
  }
  return trip;
}

/**
 * The trip the passenger should be asked to rate: their newest one, if it
 * still needs a rating.
 */
export async function findRideToRate(
  ctx: QueryCtx,
  commuterId: Id<"commuters">,
  now: number
): Promise<Doc<"rides"> | null> {
  const completed = await findCompletedCommuterRides(ctx, commuterId);
  const newest = completed[0];
  if (newest && (await rideNeedsRating(ctx, newest, now))) {
    return newest;
  }
  return null;
}

/** The passenger's live ride, in any status that still needs attention. */
export async function findLiveCommuterRide(
  ctx: QueryCtx,
  commuterId: Id<"commuters">
) {
  const rides = await ctx.db
    .query("rides")
    .withIndex("by_commuterId", (q) => q.eq("commuterId", commuterId))
    .order("desc")
    .collect();
  return (
    rides.find(
      (r) =>
        r.status === "pending" ||
        r.status === "accepted" ||
        r.status === "inProgress"
    ) ?? null
  );
}
