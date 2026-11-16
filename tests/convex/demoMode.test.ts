import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SIM_TICK_MS } from "../../convex/lib/routeProgress";
import { createTest, seedAccount, seedRide } from "./helpers";

/**
 * Demo mode is the rider's choice at booking. A demo trip is driven by the
 * server; a live trip — the default, and what every older build books —
 * follows GPS and can be ended whenever the driver says it is over.
 */

const NOT_ARRIVED = /not reached the destination/;

const PICKUP = { latitude: 10.5944, longitude: 121.9494 };
const DROPOFF = { latitude: 10.5974, longitude: 121.9494 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("offline")))
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function setUp(label: string, demoMode: boolean) {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: `${label}-demo-rider@example.com`,
    name: "Mode Rider",
    phone: `+6390000007${label.length}1`,
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: `${label}-demo-driver@example.com`,
    name: "Mode Driver",
    phone: `+6390000007${label.length}2`,
    role: "operator",
  });
  const rideId = await seedRide(t, commuter.commuterId, {
    demoMode,
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

async function startTrip({ commuter, rideId, t }: Setup) {
  await t.mutation(api.rides.confirm, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });
  vi.advanceTimersByTime(1);
  await t.finishInProgressScheduledFunctions();
}

async function simulationCount(t: Setup["t"], rideId: Id<"rides">) {
  const rows = await t.run(async (ctx) =>
    ctx.db
      .query("rideSimulations")
      .withIndex("by_rideId", (q) => q.eq("rideId", rideId))
      .collect()
  );
  return rows.length;
}

test("a live trip is not simulated", async () => {
  const setup = await setUp("nosim", false);
  await startTrip(setup);
  expect(await simulationCount(setup.t, setup.rideId)).toBe(0);
});

test("on a live trip, GPS moves the vehicle", async () => {
  const setup = await setUp("gps", false);
  const { commuter, operator, rideId, t } = setup;
  await startTrip(setup);

  await t.mutation(api.rides.updateOperatorLocation, {
    sessionToken: operator.sessionToken,
    rideId,
    latitude: 10.596,
    longitude: 121.95,
  });

  const riderView = await t.query(api.rides.getPartnerLocation, {
    sessionToken: commuter.sessionToken,
    rideId,
  });
  const seen =
    riderView && "operatorLocation" in riderView
      ? riderView.operatorLocation
      : null;
  expect(seen?.latitude).toBe(10.596);
});

test("a live trip can be ended without a simulated arrival", async () => {
  const setup = await setUp("endlive", false);
  const { operator, rideId, t } = setup;
  await startTrip(setup);

  await t.mutation(api.rides.complete, {
    sessionToken: operator.sessionToken,
    id: rideId,
    operatorId: operator.operatorId,
  });
  const ride = await t.run(async (ctx) => ctx.db.get(rideId));
  expect(ride?.status).toBe("completed");
});

test("the watchdog leaves live trips alone", async () => {
  const setup = await setUp("watch", false);
  const { rideId, t } = setup;
  await t.run(async (ctx) => {
    await ctx.db.patch(rideId, { status: "inProgress" });
  });

  await t.mutation(internal.rideSimulation.restartStalled, {});
  expect(await simulationCount(t, rideId)).toBe(0);
});

test("a simulation left on a ride that is now live stops moving", async () => {
  const setup = await setUp("leftover", true);
  const { rideId, t } = setup;
  await startTrip(setup);
  vi.advanceTimersByTime(SIM_TICK_MS);
  await t.finishInProgressScheduledFunctions();

  // The ride loses its flag — as one simulated before the choice existed.
  await t.run(async (ctx) => {
    await ctx.db.patch(rideId, { demoMode: undefined });
  });
  const read = () =>
    t.run(async (ctx) =>
      ctx.db
        .query("rideSimulations")
        .withIndex("by_rideId", (q) => q.eq("rideId", rideId))
        .unique()
    );
  const before = await read();
  vi.advanceTimersByTime(SIM_TICK_MS);
  await t.finishInProgressScheduledFunctions();
  const after = await read();
  expect(after?.traveledMeters).toBe(before?.traveledMeters);
});

test("a demo trip still cannot be ended before it arrives", async () => {
  const setup = await setUp("early", true);
  const { operator, rideId, t } = setup;
  await startTrip(setup);

  await expect(
    t.mutation(api.rides.complete, {
      sessionToken: operator.sessionToken,
      id: rideId,
      operatorId: operator.operatorId,
    })
  ).rejects.toThrow(NOT_ARRIVED);
});

test("booking twice keeps the first booking's mode", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "reuse-demo-rider@example.com",
    name: "Reuse Rider",
    phone: "+639000000781",
    role: "commuter",
  });
  const booking = {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    pickup: { address: "Pickup", ...PICKUP },
    dropoff: { address: "Dropoff", ...DROPOFF },
    distanceKm: 0.4,
  };

  const first = await t.mutation(internal.rideBooking.insert, {
    ...booking,
    demoMode: true,
  });
  expect(first.demoMode).toBe(true);

  // The second tap forgot the choice; the ride it lands on is still a demo.
  const second = await t.mutation(internal.rideBooking.insert, booking);
  expect(second.reused).toBe(true);
  expect(second.rideId).toBe(first.rideId);
  expect(second.demoMode).toBe(true);
});

test("a booking without the choice is live", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "default-demo-rider@example.com",
    name: "Default Rider",
    phone: "+639000000782",
    role: "commuter",
  });
  const result = await t.mutation(internal.rideBooking.insert, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    pickup: { address: "Pickup", ...PICKUP },
    dropoff: { address: "Dropoff", ...DROPOFF },
    distanceKm: 0.4,
  });
  expect(result.demoMode).toBe(false);
  const ride = await t.run(async (ctx) => ctx.db.get(result.rideId));
  expect(ride?.demoMode).toBeUndefined();
});
