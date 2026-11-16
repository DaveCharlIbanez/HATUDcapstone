import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import type { PaymentMethod } from "./lib/paymentMethods";
import { resolveActor } from "./lib/withAuth";

/**
 * The signed-in user's own profile screen.
 *
 * The profile pages used to render a hard-coded demo record, so a passenger
 * who signed in saw somebody else's name, phone number and ride history.
 * Everything below is read from the caller's own rows instead, and the id of
 * the row is derived from the session — never accepted from the client.
 */

/** How many rides the history list shows. */
const RECENT_RIDES_LIMIT = 20;

/** How many payment records the transaction list shows. */
const RECENT_PAYMENTS_LIMIT = 20;

/**
 * How many of the caller's rows are read to build the counters.
 *
 * Convex has no count operator, so the totals are counted from a bounded
 * scan. The bound is far above the number of rides a single account
 * accumulates, and it keeps the query from reading an unbounded number of
 * documents as the tables grow.
 */
const STATS_SCAN_LIMIT = 200;

export interface ProfileRide {
  createdAt: number;
  dropoffAddress: string;
  fare: number;
  id: Id<"rides">;
  pickupAddress: string;
  rating: number | null;
  status: "accepted" | "cancelled" | "completed" | "inProgress" | "pending";
}

export interface ProfilePayment {
  amount: number;
  createdAt: number;
  id: Id<"payments">;
  /** Where the money moved, so the history can say which method it was. */
  provider: PaymentMethod;
  referenceNumber: string;
  status: string;
}

/**
 * The caller's own passenger profile: identity, lifetime counters, recent
 * rides and payment history.
 */
export const commuterProfile = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    const { commuterId } = actor;
    if (actor.role !== "commuter" || !commuterId) {
      throw new Error("Forbidden: not a commuter");
    }

    const commuter = await ctx.db.get(commuterId);
    if (!commuter) {
      throw new Error("Commuter profile not found");
    }

    const rides = await ctx.db
      .query("rides")
      .withIndex("by_commuterId", (q) => q.eq("commuterId", commuterId))
      .order("desc")
      .take(STATS_SCAN_LIMIT);

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_commuterId", (q) => q.eq("commuterId", commuterId))
      .order("desc")
      .take(STATS_SCAN_LIMIT);

    const recentRides = rides.slice(0, RECENT_RIDES_LIMIT);
    const history: ProfileRide[] = await Promise.all(
      recentRides.map(async (ride) => {
        const feedback = await ctx.db
          .query("feedback")
          .withIndex("by_rideId", (q) => q.eq("rideId", ride._id))
          .first();

        return {
          id: ride._id,
          createdAt: ride.createdAt,
          pickupAddress: ride.pickup.address,
          dropoffAddress: ride.dropoff.address,
          fare: ride.fare,
          status: ride.status,
          rating: feedback?.rating ?? null,
        };
      })
    );

    // "Total spent" is the value of the passenger's completed rides, so it
    // always matches the fares shown in the history list. The payment ledger
    // below is the record of what has actually been charged.
    const completedRides = rides.filter((ride) => ride.status === "completed");

    return {
      id: commuter._id,
      name: commuter.name,
      email: commuter.email,
      phone: commuter.phone,
      memberSince: commuter.createdAt,
      savedLocations: commuter.savedLocations,
      completedRides: completedRides.length,
      totalSpent: completedRides.reduce((total, ride) => total + ride.fare, 0),
      history,
      payments: payments.slice(0, RECENT_PAYMENTS_LIMIT).map(
        (payment): ProfilePayment => ({
          id: payment._id,
          amount: payment.amount,
          createdAt: payment.createdAt,
          provider: payment.provider,
          referenceNumber: payment.referenceNumber,
          status: payment.status,
        })
      ),
    };
  },
});

export interface OperatorProfileRide extends ProfileRide {
  commuterName: string;
}

/**
 * The caller's own driver profile: identity, vehicle, lifetime counters and
 * the ratings passengers left.
 */
export const operatorProfile = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    const { operatorId } = actor;
    if (actor.role !== "operator" || !operatorId) {
      throw new Error("Forbidden: not an operator");
    }

    const operator = await ctx.db.get(operatorId);
    if (!operator) {
      throw new Error("Operator profile not found");
    }

    const rides = await ctx.db
      .query("rides")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", operatorId))
      .order("desc")
      .take(STATS_SCAN_LIMIT);

    const feedback = await ctx.db
      .query("feedback")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", operatorId))
      .take(STATS_SCAN_LIMIT);

    const recentRides = rides.slice(0, RECENT_RIDES_LIMIT);
    const history: OperatorProfileRide[] = await Promise.all(
      recentRides.map(async (ride) => {
        const commuter = await ctx.db.get(ride.commuterId);
        return {
          id: ride._id,
          createdAt: ride.createdAt,
          pickupAddress: ride.pickup.address,
          dropoffAddress: ride.dropoff.address,
          fare: ride.fare,
          status: ride.status,
          rating: null,
          commuterName: commuter?.name ?? "Passenger",
        };
      })
    );

    const completedRides = rides.filter((ride) => ride.status === "completed");
    const ratingTotal = feedback.reduce(
      (total, entry) => total + entry.rating,
      0
    );

    return {
      id: operator._id,
      name: operator.name,
      email: operator.email,
      phone: operator.phone,
      licenseNumber: operator.licenseNumber,
      vehicleInfo: operator.vehicleInfo,
      memberSince: operator.createdAt,
      isAvailable: operator.isAvailable,
      completedRides: completedRides.length,
      totalEarnings: completedRides.reduce(
        (total, ride) => total + ride.fare,
        0
      ),
      averageRating:
        feedback.length === 0
          ? 0
          : Math.round((ratingTotal / feedback.length) * 10) / 10,
      ratingCount: feedback.length,
      history,
    };
  },
});
