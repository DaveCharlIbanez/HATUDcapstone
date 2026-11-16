import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, query } from "./_generated/server";
import {
  buildRoute,
  initialSpeed,
  type LngLat,
  MAX_TICK_ELAPSED_MS,
  metersTravelled,
  nextSpeed,
  pointAlong,
  SIM_STALL_MS,
  SIM_TICK_MS,
} from "./lib/routeProgress";
import {
  findSimulation,
  isDemoRide,
  startRideSimulation,
} from "./lib/simulationState";
import { requireRideParticipant } from "./lib/withAuth";

/**
 * The simulated trip.
 *
 * A rider can book a demo trip (`rides.demoMode`). Once one starts, the
 * vehicle is driven along the highlighted road by the server: every three seconds it moves on by however far a vehicle doing
 * 30–50 km/h would have gone. Both screens read the same position, so the
 * passenger and the driver always see the vehicle in the same place, and
 * neither phone has to stay awake for the trip to keep moving.
 *
 * A demo ride can only be ended once the vehicle has reached the destination.
 * That rule is enforced in `convex/rideCompletion.ts`, on the server, so no
 * screen — including the older Android builds — can end a trip early.
 */

/** The vehicle has reached the end of the road. */
async function arrive(
  ctx: MutationCtx,
  simulation: Doc<"rideSimulations">,
  point: LngLat,
  now: number
): Promise<void> {
  await ctx.db.patch(simulation._id, {
    arrivedAt: now,
    lastTickAt: now,
    latitude: point[1],
    longitude: point[0],
    traveledMeters: simulation.totalMeters,
  });

  // The ride records the arrival, and where everybody ended up, once.
  const position = { latitude: point[1], longitude: point[0], updatedAt: now };
  await ctx.db.patch(simulation.rideId, {
    arrivedAt: now,
    commuterLocation: position,
    operatorLocation: position,
    updatedAt: now,
  });
}

/**
 * Stores the road and sets the vehicle off.
 *
 * Called once, by the action that fetched the road.
 */
export const begin = internalMutation({
  args: {
    rideId: v.id("rides"),
    coordinates: v.array(v.array(v.number())),
    source: v.union(v.literal("router"), v.literal("estimate")),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const simulation = await findSimulation(ctx, args.rideId);
    if (!simulation || simulation.ready) {
      return null;
    }
    const ride = await ctx.db.get(args.rideId);
    if (!ride || ride.status !== "inProgress" || !isDemoRide(ride)) {
      return null;
    }

    const route = buildRoute(
      args.coordinates.map((point) => [point[0], point[1]] as LngLat)
    );
    const now = Date.now();

    const existingRoute = await ctx.db
      .query("rideRoutes")
      .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
      .unique();
    if (!existingRoute) {
      await ctx.db.insert("rideRoutes", {
        rideId: args.rideId,
        coordinates: route.coordinates,
        cumulativeMeters: route.cumulativeMeters,
        totalMeters: route.totalMeters,
        source: args.source,
        createdAt: now,
      });
    }

    const start = pointAlong(route, 0);
    const seq = simulation.seq + 1;
    await ctx.db.patch(simulation._id, {
      ready: true,
      totalMeters: route.totalMeters,
      speedKmh: initialSpeed(Math.random()),
      latitude: start[1],
      longitude: start[0],
      lastTickAt: now,
      seq,
    });

    // A pickup and a destination in the same spot: there is nowhere to go.
    if (route.totalMeters <= 0) {
      const ready = await ctx.db.get(simulation._id);
      if (ready) {
        await arrive(ctx, ready, start, now);
      }
      return null;
    }

    await ctx.scheduler.runAfter(SIM_TICK_MS, internal.rideSimulation.tick, {
      rideId: args.rideId,
      seq,
    });
    return null;
  },
});

/**
 * One step of the trip: move the vehicle on, and book the next step.
 *
 * The distance is worked out from the time that has really passed since the
 * last step, not an assumed three seconds, so the speed stays true when the
 * scheduler runs a little late. A very late step is capped, so the vehicle
 * never jumps down the road.
 */
export const tick = internalMutation({
  args: { rideId: v.id("rides"), seq: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const simulation = await findSimulation(ctx, args.rideId);
    // A step that is not the expected one is a stray from an earlier chain —
    // a restart, or a double start — and stops, so there is only ever one.
    if (
      !simulation ||
      simulation.seq !== args.seq ||
      simulation.arrivedAt !== undefined ||
      !simulation.ready
    ) {
      return null;
    }

    // A cancelled or ended ride stops moving, and so does a live one — a
    // ride that was being simulated before demo trips became a choice.
    const ride = await ctx.db.get(args.rideId);
    if (!ride || ride.status !== "inProgress" || !isDemoRide(ride)) {
      return null;
    }

    const stored = await ctx.db
      .query("rideRoutes")
      .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
      .unique();
    if (!stored) {
      return null;
    }
    const route = {
      coordinates: stored.coordinates.map(
        (point) => [point[0], point[1]] as LngLat
      ),
      cumulativeMeters: stored.cumulativeMeters,
      totalMeters: stored.totalMeters,
    };

    const now = Date.now();
    const elapsed = Math.min(
      Math.max(0, now - simulation.lastTickAt),
      MAX_TICK_ELAPSED_MS
    );
    const speedKmh = nextSpeed(simulation.speedKmh, Math.random());
    const traveledMeters = Math.min(
      route.totalMeters,
      simulation.traveledMeters + metersTravelled(speedKmh, elapsed)
    );
    const point = pointAlong(route, traveledMeters);

    if (traveledMeters >= route.totalMeters) {
      await arrive(ctx, { ...simulation, speedKmh }, point, now);
      return null;
    }

    const seq = args.seq + 1;
    await ctx.db.patch(simulation._id, {
      traveledMeters,
      speedKmh,
      latitude: point[1],
      longitude: point[0],
      lastTickAt: now,
      seq,
    });
    await ctx.scheduler.runAfter(SIM_TICK_MS, internal.rideSimulation.tick, {
      rideId: args.rideId,
      seq,
    });
    return null;
  },
});

/**
 * The watchdog: keeps every started demo trip moving.
 *
 * A trip whose steps stopped — a failed step, a deploy at the wrong moment —
 * is picked up again where it was. A demo trip that somehow has no
 * simulation is given one, so it can still arrive and be ended. Live trips
 * follow GPS and are left alone.
 */
export const restartStalled = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const now = Date.now();

    const stalled = await ctx.db
      .query("rideSimulations")
      .withIndex("by_arrivedAt_and_lastTickAt", (q) =>
        q.eq("arrivedAt", undefined).lt("lastTickAt", now - SIM_STALL_MS)
      )
      .take(25);

    for (const simulation of stalled) {
      const ride = await ctx.db.get(simulation.rideId);
      if (!ride || ride.status !== "inProgress" || !isDemoRide(ride)) {
        // The trip was cancelled, ended by an admin, or is a live trip that
        // follows GPS. Nothing to drive.
        await ctx.db.delete(simulation._id);
        continue;
      }

      if (!simulation.ready) {
        // The road never arrived. Ask for it again.
        await ctx.db.patch(simulation._id, { lastTickAt: now });
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
        continue;
      }

      // Pick up where it left off, as if the last step was on time.
      const seq = simulation.seq + 1;
      await ctx.db.patch(simulation._id, {
        lastTickAt: now - SIM_TICK_MS,
        seq,
      });
      await ctx.scheduler.runAfter(0, internal.rideSimulation.tick, {
        rideId: ride._id,
        seq,
      });
    }

    const started = await ctx.db
      .query("rides")
      .withIndex("by_status", (q) => q.eq("status", "inProgress"))
      .take(50);
    for (const ride of started) {
      // Only a demo trip is driven; `startRideSimulation` checks that too.
      if (ride.arrivedAt === undefined && isDemoRide(ride)) {
        await startRideSimulation(ctx, ride);
      }
    }

    return null;
  },
});

/**
 * Where the vehicle is on a started trip, for the people on it.
 */
export const getForRide = query({
  args: { sessionToken: v.string(), rideId: v.id("rides") },
  handler: async (ctx, args) => {
    await requireRideParticipant(ctx, args.sessionToken, args.rideId);
    const simulation = await findSimulation(ctx, args.rideId);
    if (!simulation) {
      return null;
    }
    return {
      arrivedAt: simulation.arrivedAt ?? null,
      lastTickAt: simulation.lastTickAt,
      latitude: simulation.latitude,
      longitude: simulation.longitude,
      ready: simulation.ready,
      speedKmh: simulation.speedKmh,
      totalMeters: simulation.totalMeters,
      traveledMeters: simulation.traveledMeters,
    };
  },
});

/**
 * The road a started trip is driven along.
 *
 * It never changes once written, so a screen downloads it once.
 */
export const getRoute = query({
  args: { sessionToken: v.string(), rideId: v.id("rides") },
  handler: async (ctx, args) => {
    await requireRideParticipant(ctx, args.sessionToken, args.rideId);
    const route = await ctx.db
      .query("rideRoutes")
      .withIndex("by_rideId", (q) => q.eq("rideId", args.rideId))
      .unique();
    if (!route) {
      return null;
    }
    return {
      coordinates: route.coordinates,
      cumulativeMeters: route.cumulativeMeters,
      totalMeters: route.totalMeters,
    };
  },
});
