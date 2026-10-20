import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

/**
 * Scheduled housekeeping.
 *
 * Expired sessions and stale login-attempt records would otherwise accumulate
 * forever.
 */

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

export default crons;
