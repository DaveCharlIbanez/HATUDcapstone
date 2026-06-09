import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireAuth,
  requireCommuterOwnership,
  requireOperatorOwnership,
} from "./lib/withAuth";

export const getById = query({
  args: { id: v.id("rides") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const listByCommuter = query({
  args: { commuterId: v.id("commuters") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("rides")
      .withIndex("by_commuterId", (q) => q.eq("commuterId", args.commuterId))
      .collect(),
});

export const listByOperator = query({
  args: { operatorId: v.id("operators") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("rides")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .collect(),
});

export const listByStatus = query({
  args: {
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("inProgress"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) =>
    await ctx.db
      .query("rides")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect(),
});

export const listPending = query({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("rides")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect(),
});

export const listPendingWithCommuter = query({
  args: {},
  handler: async (ctx) => {
    const pendingRides = await ctx.db
      .query("rides")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    return await Promise.all(
      pendingRides.map(async (ride) => {
        const commuter = await ctx.db.get(ride.commuterId);
        return { ...ride, commuter };
      })
    );
  },
});

export const getActiveByCommuter = query({
  args: { commuterId: v.id("commuters") },
  handler: async (ctx, args) => {
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
  args: { operatorId: v.id("operators") },
  handler: async (ctx, args) => {
    const rides = await ctx.db
      .query("rides")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .order("desc")
      .collect();
    return (
      rides.find(
        (r) => r.status === "accepted" || r.status === "inProgress"
      ) ?? null
    );
  },
});

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
    vehicleType: v.union(
      v.literal("economy"),
      v.literal("comfort"),
      v.literal("xl")
    ),
    fare: v.optional(v.number()),
    distance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireCommuterOwnership(ctx, args.sessionToken, args.commuterId);

    const now = Date.now();
    return await ctx.db.insert("rides", {
      commuterId: args.commuterId,
      pickup: args.pickup,
      dropoff: args.dropoff,
      vehicleType: args.vehicleType,
      status: "pending",
      fare: args.fare ?? 0,
      distance: args.distance ?? 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStatus = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("rides"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("inProgress"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const { userId, role } = await requireAuth(ctx, args.sessionToken);

    const ride = await ctx.db.get(args.id);
    if (!ride) throw new Error("Ride not found");

    // Role-based status whitelist
    const allowed =
      role === "admin"
        ? ["pending", "accepted", "inProgress", "completed", "cancelled"]
        : role === "operator"
          ? ["accepted", "inProgress", "completed"]
          : ["cancelled"];

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
    if (!ride) throw new Error("Ride not found");
    if (ride.status !== "pending") throw new Error("Ride is not in pending status");

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
    if (!ride) throw new Error("Ride not found");

    // Admins can cancel any ride; commuters/operators can only cancel their own
    if (role !== "admin") {
      const commuter = await ctx.db.get(ride.commuterId);
      const operator = ride.operatorId ? await ctx.db.get(ride.operatorId) : null;
      const isCommuterOwner = commuter?.userId === userId;
      const isOperatorOwner = operator?.userId === userId;
      if (!isCommuterOwner && !isOperatorOwner) {
        throw new Error("Forbidden: you cannot cancel this ride");
      }
    }

    await ctx.db.patch(args.id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
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
    if (!ride) throw new Error("Ride not found");
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
