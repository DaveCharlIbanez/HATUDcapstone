import { expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { OPERATOR_LOCATION_FRESH_MS } from "../../convex/lib/arrival";
import { createTest, markArrived, seedAccount, seedRide } from "./helpers";

/**
 * The ride lifecycle: accept, then confirm, and the confirm starts the ride.
 *
 * The trip used to have four steps: the driver accepted, the passenger
 * confirmed, the driver said "picked up", and then the trip was under way.
 * The passenger's button said "Confirm & Start Ride" and started nothing —
 * the driver's separate tap did that. Now the passenger's confirmation starts
 * the trip, and there is one fewer step.
 */

const PICKUP = { latitude: 14.5995, longitude: 120.9842 };
const DROPOFF = { latitude: 14.65, longitude: 121.05 };

async function seedPair(t: ReturnType<typeof createTest>) {
  const commuter = await seedAccount(t, {
    email: "lifecycle@example.com",
    name: "Louie Igop",
    phone: "+639000000401",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "lifecycledriver@example.com",
    name: "John Doe",
    phone: "+639000000402",
    role: "operator",
  });
  return { commuter, operator };
}

test("the passenger's confirmation starts the trip", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  await t.mutation(api.rides.confirm, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("inProgress");
  expect(ride?.confirmedAt).toBeGreaterThan(0);
});

test("confirming twice is a no-op, not an error", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  await t.mutation(api.rides.confirm, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });
  await t.mutation(api.rides.confirm, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("inProgress");
});

test("a driver cannot start a ride the passenger never confirmed, and cancels a no-show instead", async () => {
  const t = createTest();
  const { operator } = await seedPair(t);

  const commuter = await seedAccount(t, {
    email: "lifecycle-rider@example.com",
    name: "Louie Igop",
    phone: "+639000000403",
    role: "commuter",
  });

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  // fixoct45: the driver cannot start a ride before the passenger confirms.
  await expect(
    t.mutation(api.rides.updateStatus, {
      sessionToken: operator.sessionToken,
      id: rideId,
      status: "inProgress",
    })
  ).rejects.toThrow("has not confirmed");

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("accepted");
  expect(ride?.confirmedAt).toBeUndefined();

  // A passenger who never shows is cancelled by the driver instead.
  await t.mutation(api.rides.cancel, {
    sessionToken: operator.sessionToken,
    id: rideId,
  });
  const cancelled = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(cancelled?.status).toBe("cancelled");
});

test("a driver still cannot walk a live ride back to accepted", async () => {
  const t = createTest();
  const { operator } = await seedPair(t);

  const commuter = await seedAccount(t, {
    email: "lifecycle-rider2@example.com",
    name: "Louie Igop",
    phone: "+639000000404",
    role: "commuter",
  });

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "inProgress",
  });

  await expect(
    t.mutation(api.rides.updateStatus, {
      sessionToken: operator.sessionToken,
      id: rideId,
      status: "accepted",
    })
  ).rejects.toThrow("Forbidden");

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("inProgress");
});

test("a driver cannot finish a trip that was never confirmed", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  await expect(
    t.mutation(api.rides.complete, {
      sessionToken: operator.sessionToken,
      id: rideId,
      operatorId: operator.operatorId,
    })
  ).rejects.toThrow("cannot be completed");

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("accepted");
});

test("a driver can finish a trip the passenger has confirmed", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  await t.mutation(api.rides.confirm, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });

  await markArrived(t, rideId);
  await t.mutation(api.rides.complete, {
    sessionToken: operator.sessionToken,
    id: rideId,
    operatorId: operator.operatorId,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("completed");
  expect(ride?.completedAt).toBeGreaterThan(0);
});

test("a confirmation is refused while the driver is still on the way", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  // The driver is three kilometres from the pickup, and said so just now.
  await t.run(async (ctx) => {
    await ctx.db.patch(rideId, {
      operatorLocation: {
        latitude: PICKUP.latitude + 0.027,
        longitude: PICKUP.longitude,
        updatedAt: Date.now(),
      },
    });
  });

  await expect(
    t.mutation(api.rides.confirm, {
      sessionToken: commuter.sessionToken,
      id: rideId,
    })
  ).rejects.toThrow("still on the way");

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("accepted");
});

test("a confirmation is allowed when the driver has not reported a fresh position", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  // A stale fix says nothing about where the driver is now. It must never
  // lock the passenger out of their own trip.
  await t.run(async (ctx) => {
    await ctx.db.patch(rideId, {
      operatorLocation: {
        latitude: PICKUP.latitude + 0.027,
        longitude: PICKUP.longitude,
        updatedAt: Date.now() - OPERATOR_LOCATION_FRESH_MS - 1000,
      },
    });
  });

  await t.mutation(api.rides.confirm, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("inProgress");
});

test("a confirmation is allowed when the driver has reported nothing at all", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  await t.mutation(api.rides.confirm, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("inProgress");
});

test("a confirmation is allowed when the driver is at the pickup point", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  await t.run(async (ctx) => {
    await ctx.db.patch(rideId, {
      operatorLocation: {
        latitude: PICKUP.latitude + 0.0001,
        longitude: PICKUP.longitude,
        updatedAt: Date.now(),
      },
    });
  });

  await t.mutation(api.rides.confirm, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("inProgress");
});

test("a ride nobody confirms is dropped by the expiry job", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("rides", {
      commuterId: commuter.commuterId,
      operatorId: operator.operatorId,
      pickup: { ...PICKUP, address: "Pickup" },
      dropoff: { ...DROPOFF, address: "Dropoff" },
      vehicleType: "standard",
      status: "accepted",
      fare: 30,
      distance: 5,
      paymentStatus: "unpaid",
      paymentMethod: "gcash",
      createdAt: now - 60 * 60 * 1000,
      updatedAt: now - 60 * 60 * 1000,
    });
  });

  await t.mutation(internal.crons.expireStaleAcceptedRides, {});

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("cancelled");
  expect(ride?.cancelledAt).toBeGreaterThan(0);
});

test("a trip that is under way is not dropped by the expiry job", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("rides", {
      commuterId: commuter.commuterId,
      operatorId: operator.operatorId,
      pickup: { ...PICKUP, address: "Pickup" },
      dropoff: { ...DROPOFF, address: "Dropoff" },
      vehicleType: "standard",
      status: "inProgress",
      fare: 30,
      distance: 5,
      paymentStatus: "unpaid",
      paymentMethod: "gcash",
      confirmedAt: now - 60 * 60 * 1000,
      createdAt: now - 60 * 60 * 1000,
      updatedAt: now - 60 * 60 * 1000,
    });
  });

  await t.mutation(internal.crons.expireStaleAcceptedRides, {});

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("inProgress");
});
