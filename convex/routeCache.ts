import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * The remembered road distance between two places.
 *
 * The cache is what makes the router affordable: the dropoff is one of a
 * couple of dozen fixed landmarks, so the same pairs come round again and
 * again.
 */

export interface RouteDistance {
  distanceKm: number;
  fetchedAt: number;
  source: "router" | "estimate";
}

/**
 * How long a measured distance is trusted before it is measured again.
 *
 * Roads are built and closed, but not often, and a month is long enough that
 * the price a passenger was quoted stays the price they pay.
 */
export const ROUTE_DISTANCE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const get = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args): Promise<RouteDistance | null> => {
    const row = await ctx.db
      .query("routeDistances")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!row) {
      return null;
    }

    return {
      distanceKm: row.distanceKm,
      fetchedAt: row.fetchedAt,
      source: row.source,
    };
  },
});

export const put = internalMutation({
  args: {
    distanceKm: v.number(),
    key: v.string(),
    source: v.union(v.literal("router"), v.literal("estimate")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("routeDistances")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        distanceKm: args.distanceKm,
        fetchedAt: Date.now(),
        source: args.source,
      });
      return;
    }

    await ctx.db.insert("routeDistances", {
      distanceKm: args.distanceKm,
      fetchedAt: Date.now(),
      key: args.key,
      source: args.source,
    });
  },
});
