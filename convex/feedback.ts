import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getById = query({
  args: { id: v.id("feedback") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const getByRideId = query({
  args: { rideId: v.id("rides") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("feedback")
      .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
      .first(),
});

export const getByOperator = query({
  args: { operatorId: v.id("operators") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("feedback")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .collect(),
});

export const getOperatorAverageRating = query({
  args: { operatorId: v.id("operators") },
  handler: async (ctx, args) => {
    const feedbacks = await ctx.db
      .query("feedback")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .collect();

    if (feedbacks.length === 0) {
      return null;
    }

    const total = feedbacks.reduce((sum, f) => sum + f.rating, 0);
    return total / feedbacks.length;
  },
});

export const create = mutation({
  args: {
    rideId: v.id("rides"),
    commuterId: v.id("commuters"),
    operatorId: v.id("operators"),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
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
      operatorId: args.operatorId,
      rating: args.rating,
      comment: args.comment,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("feedback"),
    rating: v.optional(v.number()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.id);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    if (args.rating !== undefined && (args.rating < 1 || args.rating > 5)) {
      throw new Error("Rating must be between 1 and 5");
    }

    const updates: Record<string, unknown> = {};
    if (args.rating !== undefined) {
      updates.rating = args.rating;
    }
    if (args.comment !== undefined) {
      updates.comment = args.comment;
    }

    await ctx.db.patch(args.id, updates);
  },
});
