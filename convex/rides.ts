import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { quoteFare, quoteForTrip, roadDistanceKm } from "./lib/fare";
import {
  requireRideAccessOrLegacy,
  requireRoleOrLegacy,
  requireSelfOrLegacy,
} from "./lib/legacyAccess";
import {
  projectCommuterForCounterpart,
  projectOperatorForCounterpart,
} from "./lib/projections";
import {
  requireAuth,
  requireCommuterOwnership,
  requireOperatorOwnership,
  requireRideParticipant,
  resolveActor,
} from "./lib/withAuth";

// ─── Scoped queries ───────────────────────────────────────────────────────────

export type RideStatus =
  | "pending"
  | "accepted"
  | "inProgress"
  | "completed"
  | "cancelled";

const rideStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("inProgress"),
  v.literal("completed"),
  v.literal("cancelled")
);

const vehicleTypeValidator = v.union(
  v.literal("standard"),
  v.literal("priority")
);

const coordinateValidator = v.object({
  latitude: v.number(),
  longitude: v.number(),
});

export type ActiveRidePartner =
  | ({ kind: "operator" } & ReturnType<typeof projectOperatorForCounterpart>)
  | ({ kind: "commuter" } & ReturnType<typeof projectCommuterForCounterpart>);

/**
 * The caller's own in-flight ride, together with a projected view of the
 * other party. The id of the counterpart is never taken from the client — it
 * is derived from the ride the caller actually owns.
 */
export const getActiveForMe = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);

    if (actor.role === "commuter") {
      if (!actor.commuterId) {
        return null;
      }
      const ride = await findActiveCommuterRide(ctx, actor.commuterId);
      if (!ride) {
        return null;
      }
      const operator = ride.operatorId
        ? await ctx.db.get(ride.operatorId)
        : null;
      const partner = operator
        ? {
            kind: "operator" as const,
            ...projectOperatorForCounterpart(operator),
          }
        : null;
      return { ride, partner };
    }

    if (actor.role === "operator") {
      if (!actor.operatorId) {
        return null;
      }
      const ride = await findActiveOperatorRide(ctx, actor.operatorId);
      if (!ride) {
        return null;
      }
      const commuter = await ctx.db.get(ride.commuterId);
      const partner = commuter
        ? {
            kind: "commuter" as const,
            ...projectCommuterForCounterpart(commuter),
          }
        : null;
      return { ride, partner };
    }

    throw new Error("Forbidden: this role does not have an active ride");
  },
});

/**
 * The live position of the other party on a ride the caller takes part in.
 */
export const getPartnerLocation = query({
  args: { sessionToken: v.string(), rideId: v.id("rides") },
  handler: async (ctx, args) => {
    const { actor, ride } = await requireRideParticipant(
      ctx,
      args.sessionToken,
      args.rideId
    );

    if (actor.role === "admin") {
      return {
        operatorLocation: ride.operatorLocation ?? null,
        commuterLocation: ride.commuterLocation ?? null,
      };
    }

    if (actor.role === "commuter") {
      return { operatorLocation: ride.operatorLocation ?? null };
    }

    return { commuterLocation: ride.commuterLocation ?? null };
  },
});

/**
 * The price of a trip before it is booked, for every vehicle class. The same
 * calculation runs again when the ride is created, and that result is what
 * gets locked in.
 */
export const getFareQuote = query({
  args: {
    sessionToken: v.string(),
    pickup: coordinateValidator,
    dropoff: coordinateValidator,
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.sessionToken);
    const distanceKm = roadDistanceKm(args.pickup, args.dropoff);
    return {
      distanceKm,
      standard: quoteFare("standard", distanceKm),
      priority: quoteFare("priority", distanceKm),
    };
  },
});

/**
 * The caller's most recent completed ride, used for payment and feedback.
 */
export const getLatestCompletedForMe = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (actor.role !== "commuter" || !actor.commuterId) {
      throw new Error("Forbidden: only passengers have completed rides");
    }
    const commuterId = actor.commuterId;

    const rides = await ctx.db
      .query("rides")
      .withIndex("by_commuterId", (q) => q.eq("commuterId", commuterId))
      .order("desc")
      .collect();

    return rides.find((ride) => ride.status === "completed") ?? null;
  },
});

// ─── Legacy compatibility ─────────────────────────────────────────────────────
// Superseded by getActiveForMe / getPartnerLocation. Kept only for the Android
// builds that predate session-token auth. See convex/lib/legacyAccess.ts.

export const listPendingWithCommuter = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireRoleOrLegacy(ctx, args.sessionToken, "operator");

    const pendingRides = await ctx.db
      .query("rides")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    const withCommuter = await Promise.all(
      pendingRides.map(async (ride) => {
        const commuter = await ctx.db.get(ride.commuterId);
        return {
          ...ride,
          commuter: commuter ? projectCommuterForCounterpart(commuter) : null,
        };
      })
    );

    return withCommuter;
  },
});

export const getActiveByCommuter = query({
  args: {
    commuterId: v.id("commuters"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const commuter = await ctx.db.get(args.commuterId);
    if (!commuter) {
      return null;
    }
    await requireSelfOrLegacy(ctx, args.sessionToken, commuter.userId);
    const rides = await ctx.db
      .query("rides")
      .withIndex("by_commuterId", (q) => q.eq("commuterId", args.commuterId))
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
  },
});

export const getActiveByOperator = query({
  args: {
    operatorId: v.id("operators"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operator = await ctx.db.get(args.operatorId);
    if (!operator) {
      return null;
    }
    await requireSelfOrLegacy(ctx, args.sessionToken, operator.userId);
    const rides = await ctx.db
      .query("rides")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .order("desc")
      .collect();
    return (
      rides.find((r) => r.status === "accepted" || r.status === "inProgress") ??
      null
    );
  },
});

export const getOperatorLocation = query({
  args: {
    rideId: v.id("rides"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { ride } = await requireRideAccessOrLegacy(
      ctx,
      args.sessionToken,
      args.rideId
    );
    return ride.operatorLocation ?? null;
  },
});

export const getCommuterLocation = query({
  args: {
    rideId: v.id("rides"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { ride } = await requireRideAccessOrLegacy(
      ctx,
      args.sessionToken,
      args.rideId
    );
    return ride.commuterLocation ?? null;
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    sessionToken: v.string(),
    commuterId: v.id("commuters"),
    pickup: v.object({
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
    dropoff: v.object({
      address: v.string(),
      latitude: v.number(),
      longitude: v.number(),
    }),
    vehicleType: vehicleTypeValidator,
    // Retained only so that builds which predate server-side pricing keep
    // working. The value is ignored: the fare is always computed here and
    // locked in at booking time.
    fare: v.optional(v.number()),
    distance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireCommuterOwnership(ctx, args.sessionToken, args.commuterId);

    const quote = quoteForTrip(args.vehicleType, args.pickup, args.dropoff);
    const now = Date.now();

    return await ctx.db.insert("rides", {
      commuterId: args.commuterId,
      pickup: args.pickup,
      dropoff: args.dropoff,
      vehicleType: args.vehicleType,
      status: "pending",
      fare: quote.fare,
      distance: quote.distanceKm,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStatus = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("rides"),
    status: rideStatusValidator,
  },
  handler: async (ctx, args) => {
    const { userId, role } = await requireAuth(ctx, args.sessionToken);

    const ride = await ctx.db.get(args.id);
    if (!ride) {
      throw new Error("Ride not found");
    }

    // Role-based status whitelist
    const allowed = allowedStatusesFor(role);

    if (!allowed.includes(args.status)) {
      throw new Error(`Forbidden: ${role} cannot set status to ${args.status}`);
    }

    // Operators can only update rides assigned to them
    if (role === "operator") {
      const operator = await ctx.db
        .query("operators")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (!operator || ride.operatorId !== operator._id) {
        throw new Error("Forbidden: this ride is not assigned to you");
      }
    }

    // Commuters can only cancel their own rides
    if (role === "commuter") {
      const commuter = await ctx.db
        .query("commuters")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (!commuter || ride.commuterId !== commuter._id) {
        throw new Error("Forbidden: this ride does not belong to you");
      }
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const accept = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("rides"),
    operatorId: v.id("operators"),
  },
  handler: async (ctx, args) => {
    await requireOperatorOwnership(ctx, args.sessionToken, args.operatorId);

    const ride = await ctx.db.get(args.id);
    if (!ride) {
      throw new Error("Ride not found");
    }
    if (ride.status !== "pending") {
      throw new Error("Ride is not in pending status");
    }

    const operator = await ctx.db.get(args.operatorId);
    if (!operator) {
      throw new Error("Operator not found");
    }

    // A driver may only hold one live ride at a time.
    const existing = await ctx.db
      .query("rides")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .collect();
    const liveRide = existing.find(
      (r) => r.status === "accepted" || r.status === "inProgress"
    );
    if (liveRide) {
      throw new Error("You already have an active ride");
    }
    if (!operator.isAvailable) {
      throw new Error("You must be online to accept a ride");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      operatorId: args.operatorId,
      status: "accepted",
      updatedAt: now,
    });

    await ctx.db.patch(args.operatorId, {
      isAvailable: false,
      updatedAt: now,
    });
  },
});

export const cancel = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("rides"),
  },
  handler: async (ctx, args) => {
    const { userId, role } = await requireAuth(ctx, args.sessionToken);

    const ride = await ctx.db.get(args.id);
    if (!ride) {
      throw new Error("Ride not found");
    }

    // Admins can cancel any ride; commuters/operators can only cancel their own
    if (role !== "admin") {
      const commuter = await ctx.db.get(ride.commuterId);
      const operator = ride.operatorId
        ? await ctx.db.get(ride.operatorId)
        : null;
      const isCommuterOwner = commuter?.userId === userId;
      const isOperatorOwner = operator?.userId === userId;
      if (!(isCommuterOwner || isOperatorOwner)) {
        throw new Error("Forbidden: you cannot cancel this ride");
      }
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "cancelled",
      updatedAt: now,
    });

    // Release the driver so they can take another job. A driver who still has
    // another live ride stays unavailable.
    if (ride.operatorId) {
      const operatorRides = await ctx.db
        .query("rides")
        .withIndex("by_operatorId", (q) => q.eq("operatorId", ride.operatorId))
        .collect();
      const stillBusy = operatorRides.some(
        (r) =>
          r._id !== args.id &&
          (r.status === "accepted" || r.status === "inProgress")
      );
      if (!stillBusy) {
        await ctx.db.patch(ride.operatorId, {
          isAvailable: true,
          updatedAt: now,
        });
      }
    }
  },
});

export const complete = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("rides"),
    operatorId: v.id("operators"),
  },
  handler: async (ctx, args) => {
    await requireOperatorOwnership(ctx, args.sessionToken, args.operatorId);

    const ride = await ctx.db.get(args.id);
    if (!ride) {
      throw new Error("Ride not found");
    }
    if (ride.status !== "accepted" && ride.status !== "inProgress") {
      throw new Error("Ride cannot be completed from current status");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "completed",
      updatedAt: now,
    });

    await ctx.db.patch(args.operatorId, {
      isAvailable: true,
      updatedAt: now,
    });
  },
});

export const updateOperatorLocation = mutation({
  args: {
    sessionToken: v.string(),
    rideId: v.id("rides"),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, role } = await requireAuth(ctx, args.sessionToken);

    const ride = await ctx.db.get(args.rideId);
    if (!ride) {
      throw new Error("Ride not found");
    }

    if (role !== "operator" && role !== "admin") {
      throw new Error("Forbidden: only operators can update operator location");
    }

    if (role === "operator") {
      const operator = await ctx.db
        .query("operators")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (!operator || ride.operatorId !== operator._id) {
        throw new Error("Forbidden: this ride is not assigned to you");
      }
    }

    await ctx.db.patch(args.rideId, {
      operatorLocation: {
        latitude: args.latitude,
        longitude: args.longitude,
        updatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
  },
});

export const updateCommuterLocation = mutation({
  args: {
    sessionToken: v.string(),
    rideId: v.id("rides"),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, role } = await requireAuth(ctx, args.sessionToken);

    const ride = await ctx.db.get(args.rideId);
    if (!ride) {
      throw new Error("Ride not found");
    }

    if (role !== "commuter" && role !== "admin") {
      throw new Error("Forbidden: only commuters can update commuter location");
    }

    if (role === "commuter") {
      const commuter = await ctx.db
        .query("commuters")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (!commuter || ride.commuterId !== commuter._id) {
        throw new Error("Forbidden: this ride does not belong to you");
      }
    }

    await ctx.db.patch(args.rideId, {
      commuterLocation: {
        latitude: args.latitude,
        longitude: args.longitude,
        updatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
  },
});

// ─── Internal helpers ─────────────────────────────────────────────────────────

const ADMIN_STATUSES: RideStatus[] = [
  "pending",
  "accepted",
  "inProgress",
  "completed",
  "cancelled",
];
const OPERATOR_STATUSES: RideStatus[] = ["accepted", "inProgress", "completed"];
const COMMUTER_STATUSES: RideStatus[] = ["cancelled"];

function allowedStatusesFor(
  role: "commuter" | "operator" | "admin"
): RideStatus[] {
  if (role === "admin") {
    return ADMIN_STATUSES;
  }
  if (role === "operator") {
    return OPERATOR_STATUSES;
  }
  return COMMUTER_STATUSES;
}

async function findActiveCommuterRide(
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

async function findActiveOperatorRide(
  ctx: QueryCtx,
  operatorId: Id<"operators">
) {
  const rides = await ctx.db
    .query("rides")
    .withIndex("by_operatorId", (q) => q.eq("operatorId", operatorId))
    .order("desc")
    .collect();
  return (
    rides.find((r) => r.status === "accepted" || r.status === "inProgress") ??
    null
  );
}
