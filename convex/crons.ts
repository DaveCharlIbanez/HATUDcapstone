import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

/**
 * Scheduled housekeeping.
 *
 * Expired sessions and stale login-attempt records would otherwise accumulate
 * forever, and an open request nobody takes would sit in every driver's queue
 * for good.
 */

/**
 * How long an unclaimed request stays open.
 *
 * A request that no driver takes is not a request anybody is waiting for any
 * more. It also has to be dropped, or the passenger's next booking is treated
 * as a duplicate of it.
 */
const PENDING_EXPIRY_MS = 15 * 60 * 1000;

/**
 * How long an accepted ride waits for the passenger to confirm.
 *
 * The trip is started by the passenger's confirmation, so an accepted ride is
 * a ride that is waiting for them. Half an hour is long enough for a driver to
 * arrive and for the passenger to be slow about it, and short enough that a
 * ride nobody starts does not tie anybody up for the rest of the day.
 */
const ACCEPTED_EXPIRY_MS = 30 * 60 * 1000;

export const purgeExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sessions = await ctx.db.query("sessions").collect();
    let removed = 0;
    for (const session of sessions) {
      if (session.isRevoked || session.expiresAt < now) {
        await ctx.db.delete(session._id);
        removed += 1;
      }
    }
    return { removed };
  },
});

export const purgeStaleLoginAttempts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const attempts = await ctx.db.query("loginAttempts").collect();
    let removed = 0;
    for (const attempt of attempts) {
      const lockExpired =
        attempt.lockedUntil !== undefined && attempt.lockedUntil < Date.now();
      if (attempt.lastAttemptAt < cutoff || lockExpired) {
        await ctx.db.delete(attempt._id);
        removed += 1;
      }
    }
    return { removed };
  },
});

/**
 * Drops requests that nobody took.
 *
 * A stale request is not harmless: it sits in every driver's queue, it counts
 * as the passenger's live ride, and it blocks their next booking.
 */
export const expireStalePendingRides = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - PENDING_EXPIRY_MS;
    const pending = await ctx.db
      .query("rides")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    let expired = 0;
    for (const ride of pending) {
      if (ride.createdAt < cutoff) {
        await ctx.db.patch(ride._id, {
          status: "cancelled",
          cancelledAt: now,
          updatedAt: now,
        });
        expired += 1;
      }
    }
    return { expired };
  },
});

/**
 * Drops rides that were accepted but never confirmed.
 *
 * The trip is started by the passenger's confirmation, so a ride that has a
 * driver and no confirmation is waiting for the passenger. If they never
 * confirm it is not a ride anybody is in: it holds the driver on the job and
 * it counts as the passenger's live ride, which blocks their next booking.
 */
export const expireStaleAcceptedRides = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - ACCEPTED_EXPIRY_MS;
    const accepted = await ctx.db
      .query("rides")
      .withIndex("by_status", (q) => q.eq("status", "accepted"))
      .collect();

    let expired = 0;
    for (const ride of accepted) {
      const sinceAccepted = ride.updatedAt;
      if (sinceAccepted < cutoff) {
        await ctx.db.patch(ride._id, {
          status: "cancelled",
          cancelledAt: now,
          updatedAt: now,
        });
        expired += 1;
      }
    }
    return { expired };
  },
});

const crons = cronJobs();

crons.interval(
  "Purge expired sessions",
  { hours: 24 },
  internal.crons.purgeExpiredSessions,
  {}
);

crons.interval(
  "Purge stale login attempts",
  { hours: 24 },
  internal.crons.purgeStaleLoginAttempts,
  {}
);

crons.interval(
  "Expire stale pending rides",
  { minutes: 5 },
  internal.crons.expireStalePendingRides,
  {}
);

crons.interval(
  "Expire rides nobody confirmed",
  { minutes: 5 },
  internal.crons.expireStaleAcceptedRides,
  {}
);

crons.interval(
  "Keep simulated trips moving",
  { seconds: 30 },
  internal.rideSimulation.restartStalled,
  {}
);

export default crons;
