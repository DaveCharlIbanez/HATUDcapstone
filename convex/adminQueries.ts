import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireRole } from "./lib/withAuth";

export const getActiveDriversCount = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");
    const availableOperators = await ctx.db
      .query("operators")
      .withIndex("by_isAvailable", (q) => q.eq("isAvailable", true))
      .collect();
    return availableOperators.length;
  },
});

export const getLiveTripsCount = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");
    const liveTrips = await ctx.db
      .query("rides")
      .withIndex("by_status", (q) => q.eq("status", "inProgress"))
      .collect();
    return liveTrips.length;
  },
});

export const getPendingApprovalsCount = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");
    const pendingRides = await ctx.db
      .query("rides")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return pendingRides.length;
  },
});

export const getTotalCompletedTrips = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");
    const completedTrips = await ctx.db
      .query("rides")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();
    return completedTrips.length;
  },
});

export const getMetrics = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");

    const availableOperators = await ctx.db
      .query("operators")
      .withIndex("by_isAvailable", (q) => q.eq("isAvailable", true))
      .collect();

    const pendingRides = await ctx.db
      .query("rides")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const liveTrips = await ctx.db
      .query("rides")
      .withIndex("by_status", (q) => q.eq("status", "inProgress"))
      .collect();

    const completedTrips = await ctx.db
      .query("rides")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();

    const allOperators = await ctx.db.query("operators").collect();

    const operatorsWithRatings = await Promise.all(
      allOperators.map(async (op) => {
        const feedbacks = await ctx.db
          .query("feedback")
          .withIndex("by_operatorId", (q) => q.eq("operatorId", op._id))
          .collect();
        const avgRating =
          feedbacks.length > 0
            ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
            : 0;
        return { ...op, averageRating: avgRating, totalRatings: feedbacks.length };
      })
    );

    const popularOperators = operatorsWithRatings
      .sort((a, b) => b.totalRatings - a.totalRatings)
      .slice(0, 10);

    return {
      activeDrivers: availableOperators.length,
      pendingApprovals: pendingRides.length,
      liveTrips: liveTrips.length,
      popularDrivers: popularOperators.length,
      completedTrips: completedTrips.length,
    };
  },
});

export const getPendingDrivers = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");
    const operators = await ctx.db.query("operators").collect();
    return operators.map((op) => ({
      _id: op._id,
      name: op.name,
      email: op.email,
      phone: op.phone,
      licenseNumber: op.licenseNumber,
      vehicleInfo: op.vehicleInfo,
      isAvailable: op.isAvailable,
      createdAt: op.createdAt,
    }));
  },
});

export const listOperators = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");
    const operators = await ctx.db.query("operators").collect();
    return operators;
  },
});

export const getAllRides = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");
    return await ctx.db.query("rides").collect();
  },
});

export const getRecentFeedback = query({
  args: { sessionToken: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");
    const feedbacks = await ctx.db.query("feedback").collect();
    return feedbacks.slice(-args.limit).reverse();
  },
});
