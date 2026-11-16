import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Starting the simulated trip, and reading where the vehicle is.
 *
 * Kept in a library so `rides.ts` can start a trip without importing the
 * module whose functions drive it. The driving itself is in
 * `convex/rideSimulation.ts`.
 */

/**
 * The rider booked a demo trip, which the server drives.
 *
 * A ride without the flag is a live trip that follows GPS.
 */
export function isDemoRide(ride: Pick<Doc<"rides">, "demoMode">): boolean {
  return ride.demoMode === true;
}

export async function findSimulation(
  ctx: QueryCtx,
  rideId: Id<"rides">
): Promise<Doc<"rideSimulations"> | null> {
  return await ctx.db
    .query("rideSimulations")
    .withIndex("by_rideId", (q) => q.eq("rideId", rideId))
    .unique();
}

/**
 * Starts driving a trip along its road.
 *
 * Called in the same transaction that makes the ride `inProgress`. Safe to
 * call twice: a trip that already has a simulation keeps it, so a double tap
 * or a passenger and a driver starting the trip together never make two
 * vehicles.
 *
 * The vehicle waits at the pickup point until the road has been fetched.
 */
export async function startRideSimulation(
  ctx: MutationCtx,
  ride: Doc<"rides">
): Promise<void> {
  // A live trip follows GPS. Only a demo trip is driven.
  if (!isDemoRide(ride)) {
    return;
  }
  if (await findSimulation(ctx, ride._id)) {
    return;
  }

  await ctx.db.insert("rideSimulations", {
    rideId: ride._id,
    ready: false,
    traveledMeters: 0,
    totalMeters: 0,
    speedKmh: 0,
    latitude: ride.pickup.latitude,
    longitude: ride.pickup.longitude,
    lastTickAt: Date.now(),
    seq: 0,
  });

  await ctx.scheduler.runAfter(0, internal.rideSimulationRoute.prepare, {
    rideId: ride._id,
    pickup: {
      latitude: ride.pickup.latitude,
      longitude: ride.pickup.longitude,
    },
    dropoff: {
      latitude: ride.dropoff.latitude,
      longitude: ride.dropoff.longitude,
    },
  });
}

/**
 * Where the simulated vehicle is, as a reported position.
 *
 * During the trip the passenger is in the vehicle, so this is both people's
 * position. It is what the location query hands out in place of GPS — which
 * also makes the vehicle move on the older Android builds, which only know
 * how to read a position.
 */
export async function simulatedLocation(
  ctx: QueryCtx,
  ride: Doc<"rides">
): Promise<{ latitude: number; longitude: number; updatedAt: number } | null> {
  if (ride.status !== "inProgress" || !isDemoRide(ride)) {
    return null;
  }
  const simulation = await findSimulation(ctx, ride._id);
  if (!simulation) {
    return null;
  }
  return {
    latitude: simulation.latitude,
    longitude: simulation.longitude,
    updatedAt: simulation.lastTickAt,
  };
}
