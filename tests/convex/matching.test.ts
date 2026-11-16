import { expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { canTransition } from "../../convex/lib/rideState";
import { createTest, seedAccount, seedRide, setCompletedAt } from "./helpers";

const PICKUP = { address: "Pickup", latitude: 10.5944, longitude: 121.9494 };
const DROPOFF = { address: "Dropoff", latitude: 10.5923, longitude: 121.9476 };

/**
 * The ride-matching defects reported on 2026-10-27.
 *
 * Every assertion here is a failure that reproduces on the code as it was
 * before the fix: a driver who could not take a booking, a passenger who
 * could not pick their driver up, two entries for the same passenger in the
 * driver's queue, and neither of them acceptable.
 */

async function book(
  t: ReturnType<typeof createTest>,
  commuter: { commuterId: Id<"commuters">; sessionToken: string }
) {
  return await t.action(api.rides.create, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    pickup: PICKUP,
    dropoff: DROPOFF,
    vehicleType: "standard",
    paymentMethod: "gcash",
  });
}

test("a second booking returns the ride the passenger already has", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "double@example.com",
    name: "Louie Igop",
    phone: "+639000000201",
    role: "commuter",
  });

  const first = await book(t, commuter);
  expect(first.reused).toBe(false);

  // The double tap, the retry after a slow response, the booking the
  // passenger abandoned by dismissing the sheet: all of them used to leave a
  // second open request behind.
  const second = await book(t, commuter);
  expect(second.reused).toBe(true);
  expect(second.rideId).toBe(first.rideId);

  const rides = await t.run(
    async (ctx) => await ctx.db.query("rides").collect()
  );
  expect(rides.length).toBe(1);
});

test("the passenger is shown the ride that has a driver, not the newest one", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "matched@example.com",
    name: "Louie Igop",
    phone: "+639000000202",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "driver@example.com",
    name: "John Doe",
    phone: "+639000000203",
    role: "operator",
  });

  const matched = await seedRide(t, commuter.commuterId, {
    operatorId: driver.operatorId,
    status: "accepted",
  });
  // A newer request that nobody has taken.
  const newer = await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("rides", {
      commuterId: commuter.commuterId,
      pickup: PICKUP,
      dropoff: DROPOFF,
      vehicleType: "standard",
      status: "pending",
      fare: 30,
      distance: 1,
      paymentStatus: "unpaid",
      createdAt: now,
      updatedAt: now,
    });
  });
  expect(newer).not.toBe(matched);

  const active = await t.query(api.rides.getActiveForMe, {
    sessionToken: commuter.sessionToken,
  });

  // The passenger has to see the driver who is on the way, even when a newer
  // request is sitting in the queue.
  expect(active?.ride?._id).toBe(matched);
  expect(active?.ride?.status).toBe("accepted");
  expect(active?.partner?.kind).toBe("operator");
});

test("a driver who is off shift is told to go online, not that the ride is gone", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "shift@example.com",
    name: "Louie Igop",
    phone: "+639000000204",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "shiftdriver@example.com",
    name: "John Doe",
    phone: "+639000000205",
    role: "operator",
  });

  await t.run(async (ctx) => {
    await ctx.db.patch(driver.operatorId, { isAvailable: false });
  });

  const rideId = await seedRide(t, commuter.commuterId);

  await expect(
    t.mutation(api.rides.accept, {
      sessionToken: driver.sessionToken,
      id: rideId,
      operatorId: driver.operatorId,
    })
  ).rejects.toThrow("Go online to start taking rides.");
});

test("accepting a ride does not take the driver offline", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "keepsshift@example.com",
    name: "Louie Igop",
    phone: "+639000000206",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "keepdriver@example.com",
    name: "John Doe",
    phone: "+639000000207",
    role: "operator",
  });

  const rideId = await seedRide(t, commuter.commuterId);

  await t.mutation(api.rides.accept, {
    sessionToken: driver.sessionToken,
    id: rideId,
    operatorId: driver.operatorId,
  });

  const operator = await t.run(
    async (ctx) => await ctx.db.get(driver.operatorId)
  );
  // Taking a job is not the same as ending a shift.
  expect(operator?.isAvailable).toBe(true);
});

test("a driver holding a live ride cannot take another", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "busy@example.com",
    name: "Louie Igop",
    phone: "+639000000208",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "busydriver@example.com",
    name: "John Doe",
    phone: "+639000000209",
    role: "operator",
  });

  await seedRide(t, commuter.commuterId, {
    operatorId: driver.operatorId,
    status: "accepted",
  });
  const second = await seedRide(t, commuter.commuterId);

  await expect(
    t.mutation(api.rides.accept, {
      sessionToken: driver.sessionToken,
      id: second,
      operatorId: driver.operatorId,
    })
  ).rejects.toThrow("Finish your current ride before taking another.");
});

test("the driver queue never carries a passenger's phone number", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "phone@example.com",
    name: "Louie Igop",
    phone: "+639000000210",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "phonedriver@example.com",
    name: "John Doe",
    phone: "+639000000211",
    role: "operator",
  });

  await seedRide(t, commuter.commuterId);

  const queue = await t.query(api.rides.listPendingForMe, {
    sessionToken: driver.sessionToken,
  });

  expect(queue.length).toBe(1);
  expect(queue[0]?.commuter?.name).toBe("Louie Igop");
  expect(queue[0]?.commuter).not.toHaveProperty("phone");
});

test("a ride cannot be completed without ever being under way", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "skip@example.com",
    name: "Louie Igop",
    phone: "+639000000212",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "skipdriver@example.com",
    name: "John Doe",
    phone: "+639000000213",
    role: "operator",
  });

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: driver.operatorId,
    status: "accepted",
  });

  await expect(
    t.mutation(api.rides.updateStatus, {
      sessionToken: driver.sessionToken,
      id: rideId,
      status: "completed",
    })
  ).rejects.toThrow("Forbidden");
});

test("a live ride cannot be walked back to accepted", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "back@example.com",
    name: "Louie Igop",
    phone: "+639000000214",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "backdriver@example.com",
    name: "John Doe",
    phone: "+639000000215",
    role: "operator",
  });

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: driver.operatorId,
    status: "inProgress",
  });

  await expect(
    t.mutation(api.rides.updateStatus, {
      sessionToken: driver.sessionToken,
      id: rideId,
      status: "accepted",
    })
  ).rejects.toThrow("Forbidden");
});

test("the transition table only allows a ride to move forwards", () => {
  expect(canTransition("pending", "accepted")).toBe(true);
  expect(canTransition("accepted", "inProgress")).toBe(true);
  expect(canTransition("inProgress", "completed")).toBe(true);
  expect(canTransition("pending", "cancelled")).toBe(true);

  expect(canTransition("accepted", "completed")).toBe(false);
  expect(canTransition("inProgress", "accepted")).toBe(false);
  expect(canTransition("completed", "inProgress")).toBe(false);
  expect(canTransition("cancelled", "pending")).toBe(false);
});

test("the passenger's confirmation reaches the server", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "confirm@example.com",
    name: "Louie Igop",
    phone: "+639000000216",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "confirmdriver@example.com",
    name: "John Doe",
    phone: "+639000000217",
    role: "operator",
  });
  const other = await seedAccount(t, {
    email: "other@example.com",
    name: "Someone Else",
    phone: "+639000000218",
    role: "commuter",
  });

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: driver.operatorId,
    status: "accepted",
  });

  await expect(
    t.mutation(api.rides.confirm, {
      sessionToken: other.sessionToken,
      id: rideId,
    })
  ).rejects.toThrow("does not belong to you");

  await t.mutation(api.rides.confirm, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.confirmedAt).toBeGreaterThan(0);
});

test("a passenger who has just finished a trip is given it", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "done@example.com",
    name: "Louie Igop",
    phone: "+639000000219",
    role: "commuter",
  });

  const rideId = await seedRide(t, commuter.commuterId, {
    status: "completed",
  });
  await setCompletedAt(t, rideId, Date.now());

  const active = await t.query(api.rides.getActiveForMe, {
    sessionToken: commuter.sessionToken,
  });

  // Without this the map could never reach its completed state, and the
  // "Pay & Rate Driver" button could never be reached from the map.
  expect(active?.ride).toBeNull();
  expect(active?.latestCompleted?._id).toBe(rideId);
});

test("a stale request is dropped by the expiry job", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "stale@example.com",
    name: "Louie Igop",
    phone: "+639000000220",
    role: "commuter",
  });

  const rideId = await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("rides", {
      commuterId: commuter.commuterId,
      pickup: PICKUP,
      dropoff: DROPOFF,
      vehicleType: "standard",
      status: "pending",
      fare: 30,
      distance: 1,
      paymentStatus: "unpaid",
      // Half an hour ago, which is past the fifteen minute window.
      createdAt: now - 30 * 60 * 1000,
      updatedAt: now - 30 * 60 * 1000,
    });
  });

  await t.mutation(internal.crons.expireStalePendingRides, {});

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("cancelled");
  expect(ride?.cancelledAt).toBeGreaterThan(0);
});

test("two drivers cannot take the same request", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "race@example.com",
    name: "Louie Igop",
    phone: "+639000000221",
    role: "commuter",
  });
  const first = await seedAccount(t, {
    email: "race1@example.com",
    name: "First Driver",
    phone: "+639000000222",
    role: "operator",
  });
  const second = await seedAccount(t, {
    email: "race2@example.com",
    name: "Second Driver",
    phone: "+639000000223",
    role: "operator",
  });

  const rideId = await seedRide(t, commuter.commuterId);

  await t.mutation(api.rides.accept, {
    sessionToken: first.sessionToken,
    id: rideId,
    operatorId: first.operatorId,
  });

  await expect(
    t.mutation(api.rides.accept, {
      sessionToken: second.sessionToken,
      id: rideId,
      operatorId: second.operatorId,
    })
  ).rejects.toThrow("already taken by another driver");
});

test("the repair leaves one live ride per passenger and repairs the shift", async () => {
  process.env.REPAIR_KEY = "test-repair-key";
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "repair@example.com",
    name: "Louie Igop",
    phone: "+639000000224",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "repairdriver@example.com",
    name: "John Doe",
    phone: "+639000000225",
    role: "operator",
  });

  const matched = await seedRide(t, commuter.commuterId, {
    operatorId: driver.operatorId,
    status: "accepted",
  });
  const duplicate = await seedRide(t, commuter.commuterId);

  await t.run(async (ctx) => {
    // The old `accept` took the driver offline.
    await ctx.db.patch(driver.operatorId, { isAvailable: false });
  });

  const summary = await t.mutation(internal.repair.rides, {
    repairKey: "test-repair-key",
  });

  expect(summary.duplicateRidesCancelled).toBe(1);
  expect(summary.driversPutBackOnShift).toBe(1);

  const kept = await t.run(async (ctx) => await ctx.db.get(matched));
  const dropped = await t.run(async (ctx) => await ctx.db.get(duplicate));
  const operator = await t.run(
    async (ctx) => await ctx.db.get(driver.operatorId)
  );

  // The ride the driver is on is the one that is kept.
  expect(kept?.status).toBe("accepted");
  expect(dropped?.status).toBe("cancelled");
  expect(operator?.isAvailable).toBe(true);
});
