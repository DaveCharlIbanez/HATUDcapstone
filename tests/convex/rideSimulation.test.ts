import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  MAX_SPEED_KMH,
  MIN_SPEED_KMH,
  SIM_STALL_MS,
  SIM_TICK_MS,
} from "../../convex/lib/routeProgress";
import { createTest, seedAccount, seedRide } from "./helpers";

const NOT_ARRIVED = /not reached the destination/;

// A short trip, about 330 m: thirty seconds or so at 30–50 km/h.
const PICKUP = { latitude: 10.5944, longitude: 121.9494 };
const DROPOFF = { latitude: 10.5974, longitude: 121.9494 };

/** The router answers with a road through a point just off the straight line. */
function routerReturnsRoad() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        routes: [
          {
            geometry: {
              coordinates: [
                [PICKUP.longitude, PICKUP.latitude],
                [121.9495, 10.5959],
                [DROPOFF.longitude, DROPOFF.latitude],
              ],
            },
          },
        ],
      })
    )
  );
}

function routerIsDown() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("offline")))
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  routerReturnsRoad();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function setUp(label: string) {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: `${label}-rider@example.com`,
    name: "Sim Rider",
    phone: `+6390000009${label.length}1`,
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: `${label}-driver@example.com`,
    name: "Sim Driver",
    phone: `+6390000009${label.length}2`,
    role: "operator",
  });
  const rideId = await seedRide(t, commuter.commuterId, {
    demoMode: true,
    operatorId: operator.operatorId,
    status: "accepted",
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(rideId, {
      pickup: { address: "Pickup", ...PICKUP },
      dropoff: { address: "Dropoff", ...DROPOFF },
    });
  });
  return { commuter, operator, rideId, t };
}

type Setup = Awaited<ReturnType<typeof setUp>>;

/** Runs whatever is due now: the road fetch, or the next step. */
async function runDue(t: Setup["t"], ms: number) {
  vi.advanceTimersByTime(ms);
  await t.finishInProgressScheduledFunctions();
}

async function simulationOf(t: Setup["t"], rideId: Id<"rides">) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("rideSimulations")
      .withIndex("by_rideId", (q) => q.eq("rideId", rideId))
      .unique()
  );
}

async function start({ commuter, rideId, t }: Setup) {
  await t.mutation(api.rides.confirm, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });
  // The road is fetched straight away.
  await runDue(t, 1);
}

test("the vehicle drives the road at 30–50 km/h, every three seconds, and arrives", async () => {
  const setup = await setUp("drive");
  const { operator, rideId, t } = setup;
  await start(setup);

  let simulation = await simulationOf(t, rideId);
  expect(simulation?.ready).toBe(true);
  expect(simulation?.latitude).toBeCloseTo(PICKUP.latitude, 6);

  let steps = 0;
  while (!simulation?.arrivedAt && steps < 100) {
    const before = simulation?.traveledMeters ?? 0;
    await runDue(t, SIM_TICK_MS);
    simulation = await simulationOf(t, rideId);
    steps++;

    expect(simulation?.speedKmh).toBeGreaterThanOrEqual(MIN_SPEED_KMH);
    expect(simulation?.speedKmh).toBeLessThanOrEqual(MAX_SPEED_KMH);
    const moved = (simulation?.traveledMeters ?? 0) - before;
    expect(moved).toBeLessThanOrEqual(42);
    if (!simulation?.arrivedAt) {
      expect(moved).toBeGreaterThanOrEqual(24.9);
    }
  }

  // ~330 m at 25–42 m a step.
  expect(steps).toBeGreaterThanOrEqual(8);
  expect(steps).toBeLessThanOrEqual(14);

  const ride = await t.run(async (ctx) => ctx.db.get(rideId));
  expect(ride?.arrivedAt).toBeDefined();
  expect(ride?.operatorLocation?.latitude).toBeCloseTo(DROPOFF.latitude, 6);

  await t.mutation(api.rides.complete, {
    sessionToken: operator.sessionToken,
    id: rideId,
    operatorId: operator.operatorId,
  });
  const completed = await t.run(async (ctx) => ctx.db.get(rideId));
  expect(completed?.status).toBe("completed");
});

test("the ride cannot be ended before the vehicle reaches the destination", async () => {
  const setup = await setUp("early");
  const { operator, rideId, t } = setup;
  await start(setup);
  await runDue(t, SIM_TICK_MS);

  await expect(
    t.mutation(api.rides.complete, {
      sessionToken: operator.sessionToken,
      id: rideId,
      operatorId: operator.operatorId,
    })
  ).rejects.toThrow(NOT_ARRIVED);
});

test("both people see the vehicle in the same place, and GPS cannot move it", async () => {
  const setup = await setUp("same");
  const { commuter, operator, rideId, t } = setup;
  await start(setup);
  await runDue(t, SIM_TICK_MS);

  await t.mutation(api.rides.updateOperatorLocation, {
    sessionToken: operator.sessionToken,
    rideId,
    latitude: 0,
    longitude: 0,
  });

  const riderView = await t.query(api.rides.getPartnerLocation, {
    sessionToken: commuter.sessionToken,
    rideId,
  });
  const driverView = await t.query(api.rides.getPartnerLocation, {
    sessionToken: operator.sessionToken,
    rideId,
  });
  const simulation = await simulationOf(t, rideId);

  const riderSees =
    riderView && "operatorLocation" in riderView
      ? riderView.operatorLocation
      : null;
  const driverSees =
    driverView && "commuterLocation" in driverView
      ? driverView.commuterLocation
      : null;
  expect(riderSees?.latitude).toBe(simulation?.latitude);
  expect(driverSees?.latitude).toBe(simulation?.latitude);
  expect(riderSees?.latitude).not.toBe(0);
});

test("a cancelled trip stops moving", async () => {
  const setup = await setUp("cancel");
  const { commuter, rideId, t } = setup;
  await start(setup);
  await runDue(t, SIM_TICK_MS);

  await t.run(async (ctx) => {
    await ctx.db.patch(rideId, { status: "cancelled" });
  });
  const before = await simulationOf(t, rideId);
  await runDue(t, SIM_TICK_MS);
  await runDue(t, SIM_TICK_MS);
  const after = await simulationOf(t, rideId);

  expect(after?.traveledMeters).toBe(before?.traveledMeters);
  expect(commuter).toBeDefined();
});

test("starting the trip twice still drives one vehicle", async () => {
  const setup = await setUp("twice");
  const { commuter, operator, rideId, t } = setup;
  await start(setup);
  await t.mutation(api.rides.confirm, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });
  await t.mutation(api.rides.updateStatus, {
    sessionToken: operator.sessionToken,
    id: rideId,
    status: "inProgress",
  });

  const rows = await t.run(async (ctx) =>
    ctx.db
      .query("rideSimulations")
      .withIndex("by_rideId", (q) => q.eq("rideId", rideId))
      .collect()
  );
  expect(rows).toHaveLength(1);
});

test("with the router down, the trip is driven in a straight line and still arrives", async () => {
  routerIsDown();
  const setup = await setUp("offline");
  const { rideId, t } = setup;
  await start(setup);

  const route = await t.run(async (ctx) =>
    ctx.db
      .query("rideRoutes")
      .withIndex("by_rideId", (q) => q.eq("rideId", rideId))
      .unique()
  );
  expect(route?.source).toBe("estimate");

  for (let step = 0; step < 30; step++) {
    await runDue(t, SIM_TICK_MS);
  }
  const ride = await t.run(async (ctx) => ctx.db.get(rideId));
  expect(ride?.arrivedAt).toBeDefined();
});

test("the watchdog restarts a trip that stopped moving", async () => {
  const setup = await setUp("stall");
  const { rideId, t } = setup;
  await start(setup);
  await runDue(t, SIM_TICK_MS);

  // The chain of steps is lost: the next step no longer matches.
  await t.run(async (ctx) => {
    const simulation = await ctx.db
      .query("rideSimulations")
      .withIndex("by_rideId", (q) => q.eq("rideId", rideId))
      .unique();
    if (simulation) {
      await ctx.db.patch(simulation._id, { seq: 999 });
    }
  });
  await runDue(t, SIM_TICK_MS);
  const stalled = await simulationOf(t, rideId);

  vi.advanceTimersByTime(SIM_STALL_MS + 1);
  await t.mutation(internal.rideSimulation.restartStalled, {});
  await runDue(t, 1);

  const resumed = await simulationOf(t, rideId);
  expect(resumed?.traveledMeters).toBeGreaterThan(stalled?.traveledMeters ?? 0);
});

test("a demo trip that has no simulation is given one", async () => {
  const setup = await setUp("legacy");
  const { rideId, t } = setup;
  await t.run(async (ctx) => {
    await ctx.db.patch(rideId, { status: "inProgress" });
  });

  await t.mutation(internal.rideSimulation.restartStalled, {});
  await runDue(t, 1);

  const simulation = await simulationOf(t, rideId);
  expect(simulation?.ready).toBe(true);
});
