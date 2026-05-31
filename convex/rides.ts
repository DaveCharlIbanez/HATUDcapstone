import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

export const create = mutation({
  args: {
    commuterId: v.id("commuters"),
    operatorId: v.id("operators"),
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
    fare: v.number(),
    distance: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("rides", {
      commuterId: args.commuterId,
      operatorId: args.operatorId,
      pickup: args.pickup,
      dropoff: args.dropoff,
      status: "pending",
      fare: args.fare,
      distance: args.distance,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStatus = mutation({
  args: {
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
    const ride = await ctx.db.get(args.id);
    if (!ride) {
      throw new Error("Ride not found");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const accept = mutation({
  args: {
    id: v.id("rides"),
    operatorId: v.id("operators"),
  },
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.id);
    if (!ride) {
      throw new Error("Ride not found");
    }

    if (ride.status !== "pending") {
      throw new Error("Ride is not in pending status");
    }

    await ctx.db.patch(args.id, {
      operatorId: args.operatorId,
      status: "accepted",
      updatedAt: Date.now(),
    });
  },
});

export const cancel = mutation({
  args: { id: v.id("rides") },
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.id);
    if (!ride) {
      throw new Error("Ride not found");
    }

    await ctx.db.patch(args.id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
  },
});

export const complete = mutation({
  args: { id: v.id("rides") },
  handler: async (ctx, args) => {
    const ride = await ctx.db.get(args.id);
    if (!ride) {
      throw new Error("Ride not found");
    }

    if (ride.status !== "accepted" && ride.status !== "inProgress") {
      throw new Error("Ride cannot be completed from current status");
    }

    await ctx.db.patch(args.id, {
      status: "completed",
      updatedAt: Date.now(),
    });
  },
});
