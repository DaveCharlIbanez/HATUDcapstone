import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { coordinateValidator, fetchRoadGeometry } from "./lib/routing";

/**
 * Fetches the road a started trip is driven along.
 *
 * An action because it makes a network call. It is the same router, and the
 * same pickup-to-destination road, that the fare was measured on.
 *
 * When the router cannot be reached the trip is driven along a straight line
 * instead. A trip that could not be driven could never arrive, and a trip
 * that never arrives could never be ended.
 */
export const prepare = internalAction({
  args: {
    rideId: v.id("rides"),
    pickup: coordinateValidator,
    dropoff: coordinateValidator,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const road = await fetchRoadGeometry(args.pickup, args.dropoff);

    const pickup: [number, number] = [
      args.pickup.longitude,
      args.pickup.latitude,
    ];
    const dropoff: [number, number] = [
      args.dropoff.longitude,
      args.dropoff.latitude,
    ];

    // The router starts and ends the road on the nearest street, which can be
    // a few metres from the pins. The pins are added at both ends so the
    // vehicle sets off from the pickup pin and stops on the destination pin.
    const coordinates = road ? [pickup, ...road, dropoff] : [pickup, dropoff];

    await ctx.runMutation(internal.rideSimulation.begin, {
      rideId: args.rideId,
      coordinates,
      source: road ? "router" : "estimate",
    });
    return null;
  },
});
