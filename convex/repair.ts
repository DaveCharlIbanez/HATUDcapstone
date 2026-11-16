import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { VEHICLE_TYPE } from "./lib/fare";
import { DEFAULT_PAYMENT_METHOD } from "./lib/paymentMethods";
import { clearPresence } from "./presence";

/**
 * One-shot repair for rides left in an inconsistent state.
 *
 * The bugs this repairs were live for a while, so the database already holds
 * rows the fixed code would never create:
 *
 * 1. **Duplicate live rides.** A passenger could open a second request — a
 *    double tap, a retry, a booking they abandoned by dismissing the sheet —
 *    and both requests stayed open. The app then attached the passenger to the
 *    newer one, so a driver driving to their pickup point was invisible to
 *    them, and a second driver could be matched to the same passenger.
 * 2. **Drivers taken offline by their own ride.** Accepting a ride used to set
 *    `isAvailable: false`, so a driver on a trip was recorded as off shift, and
 *    completing one put them back on shift. A driver who finished a trip
 *    through `updateStatus` rather than `complete` was never restored and was
 *    offline for good.
 * 3. **Pending requests that already name a driver.** Such a row cannot be
 *    claimed by anybody and never left the queue.
 *
 * The repair only ever touches `pending` and `accepted`/`inProgress` rides. A
 * completed or paid ride is never modified, so no money is ever moved by it.
 *
 * Required deployment environment variable:
 *   REPAIR_KEY              shared secret passed as the `repairKey` argument
 *                            (falls back to SEED_KEY when it is not set)
 *
 * Usage:
 *   npx convex env set REPAIR_KEY "$(openssl rand -hex 16)"
 *   npx convex run internal.repair.rides '{"repairKey":"<the key you set>"}'
 */

interface RepairSummary {
  /** Drivers who were on a trip but recorded as off shift. */
  driversPutBackOnShift: number;
  /** Live rides that were dropped because the passenger already had one. */
  duplicateRidesCancelled: number;
  /** The rides that were kept, one per passenger. */
  ridesKept: number;
  /** Pending requests that named a driver and could never be claimed. */
  unclaimableRidesCleared: number;
}

function requireRepairKey(provided: string): void {
  const expected = process.env.REPAIR_KEY ?? process.env.SEED_KEY;
  if (!expected) {
    throw new Error(
      "Repair is disabled: REPAIR_KEY is not set on this deployment."
    );
  }
  if (provided !== expected) {
    throw new Error("Forbidden: invalid repair key");
  }
}

type RideDoc = Doc<"rides">;

const LIVE_STATUSES = ["pending", "accepted", "inProgress"] as const;

function isLive(ride: RideDoc): boolean {
  return LIVE_STATUSES.includes(ride.status as (typeof LIVE_STATUSES)[number]);
}

function hasDriver(ride: RideDoc): boolean {
  return ride.status === "accepted" || ride.status === "inProgress";
}

/**
 * A pending request that names a driver cannot be claimed by anybody, so the
 * driver is taken off the row and the request goes back into the queue.
 */
async function clearUnclaimableRides(
  ctx: MutationCtx,
  rides: RideDoc[],
  now: number
): Promise<number> {
  let cleared = 0;
  for (const ride of rides) {
    if (ride.status === "pending" && ride.operatorId !== undefined) {
      await ctx.db.patch(ride._id, {
        operatorId: undefined,
        updatedAt: now,
      });
      cleared += 1;
    }
  }
  return cleared;
}

/**
 * A passenger may only have one live ride.
 *
 * The ride that has a driver is the one the passenger is actually with, so
 * that is the one that is kept. Otherwise the oldest request is kept — it is
 * the one the passenger actually asked for.
 */
function chooseKeeper(bucket: RideDoc[]): RideDoc | undefined {
  const matched = bucket.find(hasDriver);
  if (matched) {
    return matched;
  }
  return [...bucket].sort((a, b) => a.createdAt - b.createdAt)[0];
}

/**
 * Cancels the surplus live rides, one per passenger.
 */
async function cancelDuplicateRides(
  ctx: MutationCtx,
  rides: RideDoc[],
  now: number
): Promise<{ cancelled: number; kept: number }> {
  const liveByCommuter = new Map<string, RideDoc[]>();
  for (const ride of rides) {
    if (!isLive(ride)) {
      continue;
    }
    const bucket = liveByCommuter.get(ride.commuterId) ?? [];
    bucket.push(ride);
    liveByCommuter.set(ride.commuterId, bucket);
  }

  let cancelled = 0;
  let kept = 0;
  for (const bucket of liveByCommuter.values()) {
    const keeper = chooseKeeper(bucket);
    for (const ride of bucket) {
      if (ride._id === keeper?._id) {
        continue;
      }
      await ctx.db.patch(ride._id, {
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
      });
      cancelled += 1;
    }
    kept += 1;
  }

  return { cancelled, kept };
}

/**
 * A driver who is on a trip is on shift. The old code took them offline when
 * they accepted a ride, so they were recorded as off shift for the whole
 * journey.
 */
async function restoreDriverShifts(
  ctx: MutationCtx,
  rides: RideDoc[],
  operators: Doc<"operators">[],
  now: number
): Promise<number> {
  let restored = 0;
  for (const operator of operators) {
    const onAJob = rides.some(
      (ride) => ride.operatorId === operator._id && hasDriver(ride)
    );
    if (onAJob && !operator.isAvailable) {
      await ctx.db.patch(operator._id, {
        isAvailable: true,
        updatedAt: now,
      });
      restored += 1;
    }
  }
  return restored;
}

export const rides = internalMutation({
  args: { repairKey: v.string() },
  handler: async (ctx, args): Promise<RepairSummary> => {
    requireRepairKey(args.repairKey);

    const now = Date.now();
    const allRides = await ctx.db.query("rides").collect();
    const operators = await ctx.db.query("operators").collect();

    const unclaimableRidesCleared = await clearUnclaimableRides(
      ctx,
      allRides,
      now
    );
    const { cancelled, kept } = await cancelDuplicateRides(ctx, allRides, now);
    const driversPutBackOnShift = await restoreDriverShifts(
      ctx,
      allRides,
      operators,
      now
    );

    return {
      duplicateRidesCancelled: cancelled,
      driversPutBackOnShift,
      unclaimableRidesCleared,
      ridesKept: kept,
    };
  },
});

/**
 * Records when the trips that had already finished ended.
 *
 * The map only greets a passenger with a trip they have just come back
 * from, and it tells that from the moment the trip ended. The trips that
 * finished before this field existed do not have it, so it is backfilled from
 * the moment the ride was last touched.
 */
export const completedAt = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rides = await ctx.db.query("rides").collect();
    let backfilled = 0;

    for (const ride of rides) {
      if (ride.status === "completed" && ride.completedAt === undefined) {
        await ctx.db.patch(ride._id, { completedAt: ride.updatedAt });
        backfilled += 1;
      }
    }

    return { backfilled };
  },
});

/**
 * Records how the rides that are still running are going to be paid for.
 *
 * The payment method is chosen when the ride is booked, and the rides that
 * were booked before it was chosen do not have one. Those were all settled
 * through GCash, because GCash was the only thing the app could do, so that
 * is what they are marked as. The driver has to know what they are collecting
 * before they accept a ride.
 */
export const paymentMethod = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rides = await ctx.db.query("rides").collect();
    let backfilled = 0;

    for (const ride of rides) {
      const isLive =
        ride.status === "pending" ||
        ride.status === "accepted" ||
        ride.status === "inProgress";
      if (isLive && ride.paymentMethod === undefined) {
        await ctx.db.patch(ride._id, {
          paymentMethod: DEFAULT_PAYMENT_METHOD,
          updatedAt: Date.now(),
        });
        backfilled += 1;
      }
    }

    return { backfilled };
  },
});

/**
 * Marks every ride as the one ride type there is.
 *
 * The rides booked before there was only one were booked as "priority" or as
 * one of the motorcycle classes that have never been offered. There is no
 * Priority ride any more, so the rows that name one are marked as the ride
 * that exists.
 *
 * This has to run before the schema is narrowed to a single ride type: a row
 * that names a type the schema no longer allows is a row the server cannot
 * read.
 */
export const vehicleType = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rides = await ctx.db.query("rides").collect();
    let rewritten = 0;

    for (const ride of rides) {
      if (ride.vehicleType !== VEHICLE_TYPE) {
        await ctx.db.patch(ride._id, {
          vehicleType: VEHICLE_TYPE,
          updatedAt: Date.now(),
        });
        rewritten += 1;
      }
    }

    return { rewritten };
  },
});

/**
 * Deletes driver accounts that are not real drivers (fixoct51, part 2).
 *
 * Used to remove a seed driver nobody signs in as and a driver who went on
 * shift once and never came back. Their rides are kept — they are the
 * passengers' history, and every reader of `ride.operatorId` already handles
 * a driver that no longer exists — but everything that belongs to the
 * account itself goes: documents and their files, sessions, presence, the
 * operator profile and the user.
 *
 * Refuses an account that is not an operator, or one with a live ride, so a
 * mistyped address cannot take out a passenger or strand a trip.
 *
 * Usage:
 *   npx convex run internal.repair.deleteOperatorAccounts \
 *     '{"repairKey":"<key>","emails":["someone@example.com"]}'
 */
export const deleteOperatorAccounts = internalMutation({
  args: { repairKey: v.string(), emails: v.array(v.string()) },
  handler: async (ctx, args) => {
    requireRepairKey(args.repairKey);
    const removed: { email: string; keptRides: number }[] = [];
    const notFound: string[] = [];

    for (const email of args.emails) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (!user) {
        notFound.push(email);
        continue;
      }
      if (user.role !== "operator") {
        throw new Error(`Refusing to delete ${email}: not an operator`);
      }
      const operator = await ctx.db
        .query("operators")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique();

      let keptRides = 0;
      if (operator) {
        const rides = await ctx.db
          .query("rides")
          .withIndex("by_operatorId", (q) => q.eq("operatorId", operator._id))
          .collect();
        const live = rides.filter(
          (ride) =>
            ride.status === "pending" ||
            ride.status === "accepted" ||
            ride.status === "inProgress"
        );
        if (live.length > 0) {
          throw new Error(`Refusing to delete ${email}: has a live ride`);
        }
        keptRides = rides.length;

        const documents = await ctx.db
          .query("operatorDocuments")
          .withIndex("by_operatorId", (q) => q.eq("operatorId", operator._id))
          .collect();
        for (const document of documents) {
          const storageId = ctx.db.system.normalizeId(
            "_storage",
            document.storageId
          );
          if (storageId) {
            await ctx.storage.delete(storageId);
          }
          await ctx.db.delete(document._id);
        }
        await ctx.db.delete(operator._id);
      }

      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();
      for (const session of sessions) {
        await ctx.db.delete(session._id);
      }
      await clearPresence(ctx, user._id);
      await ctx.db.delete(user._id);
      removed.push({ email, keptRides });
    }

    return { notFound, removed };
  },
});
