import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  coordinateValidator,
  estimateRoadKm,
  fetchRoadDistanceKm,
  routeCacheKey,
} from "./lib/routing";
import { ROUTE_DISTANCE_TTL_MS, type RouteDistance } from "./routeCache";

/**
 * The distance between two places, measured once and remembered.
 *
 * The router is asked only when the answer is not already known. A cached
 * answer is returned untouched, so the distance behind a quote and the
 * distance behind the booking are the same number.
 *
 * This is an action because it makes a network call, and a Convex action is
 * the only kind of function that can.
 */
export const getOrFetch = internalAction({
  args: {
    dropoff: coordinateValidator,
    pickup: coordinateValidator,
  },
  handler: async (ctx, args): Promise<RouteDistance> => {
    const key = routeCacheKey(args.pickup, args.dropoff);
    const cached = await ctx.runQuery(internal.routeCache.get, { key });

    if (cached && Date.now() - cached.fetchedAt < ROUTE_DISTANCE_TTL_MS) {
      return cached;
    }

    const measured = await fetchRoadDistanceKm(args.pickup, args.dropoff);
    const distanceKm = measured ?? estimateRoadKm(args.pickup, args.dropoff);
    const source = measured === null ? "estimate" : "router";

    await ctx.runMutation(internal.routeCache.put, {
      distanceKm,
      key,
      source,
    });

    return { distanceKm, fetchedAt: Date.now(), source };
  },
});
