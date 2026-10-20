import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCommuterOwnership, resolveActor } from "./lib/withAuth";

// Feedback rows are only readable by the passenger who wrote them or by the
// driver being rated. The old by-id / by-ride / by-operator lookups were
// unauthenticated and had no callers.

/**
 * The caller's own average rating as a driver. Drivers and admins only.
 */
export const getAverageForOperator = query({
  args: {
    sessionToken: v.string(),
    operatorId: v.id("operators"),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (actor.role !== "admin" && actor.operatorId !== args.operatorId) {
      throw new Error("Forbidden: you do not own this operator profile");
    }

    const feedback = await ctx.db
      .query("feedback")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .collect();

    if (feedback.length === 0) {
      return { average: 0, count: 0 };
    }

    const total = feedback.reduce((sum, row) => sum + row.rating, 0);
    return {
      average: Math.round((total / feedback.length) * 10) / 10,
      count: feedback.length,
    };
  },
});

export const create = mutation({
  args: {
    sessionToken: v.string(),
    rideId: v.id("rides"),
    commuterId: v.id("commuters"),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireCommuterOwnership(ctx, args.sessionToken, args.commuterId);

    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    // Verify the ride actually belongs to this commuter
    const ride = await ctx.db.get(args.rideId);
    if (!ride || ride.commuterId !== args.commuterId) {
      throw new Error("Forbidden: this ride does not belong to your account");
    }

    if (ride.status !== "completed") {
      throw new Error("Feedback can only be left for a completed ride");
    }

    if (!ride.operatorId) {
      throw new Error("This ride has no driver to rate");
    }

    const existing = await ctx.db
      .query("feedback")
      .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
      .first();

    if (existing) {
      throw new Error("Feedback already exists for this ride");
    }

    return await ctx.db.insert("feedback", {
      rideId: args.rideId,
      commuterId: args.commuterId,
      // Derived from the ride, never from the client.
      operatorId: ride.operatorId,
      rating: args.rating,
      comment: args.comment,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("feedback"),
    rating: v.optional(v.number()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.id);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    await requireCommuterOwnership(ctx, args.sessionToken, feedback.commuterId);

    if (args.rating !== undefined && (args.rating < 1 || args.rating > 5)) {
      throw new Error("Rating must be between 1 and 5");
    }

    const updates: { rating?: number; comment?: string } = {};
    if (args.rating !== undefined) {
      updates.rating = args.rating;
    }
    if (args.comment !== undefined) {
      updates.comment = args.comment;
    }

    await ctx.db.patch(args.id, updates);
  },
});
