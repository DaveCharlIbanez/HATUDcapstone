import { expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import {
  GCASH_SANDBOX_DECLINE_NUMBER,
  MAYA_SANDBOX_DECLINE_NUMBER,
} from "../../convex/lib/payments";
import { createTest, markArrived, seedAccount, seedRide } from "./helpers";

/**
 * The payment modality, and the ride it belongs to.
 *
 * The rider chooses how they are paying when they book, and the choice is
 * fixed for the life of the ride: the driver has to know before they accept
 * whether they are collecting cash.
 */

const PICKUP = { latitude: 14.5995, longitude: 120.9842 };
const DROPOFF = { latitude: 14.65, longitude: 121.05 };

async function seedPair(t: ReturnType<typeof createTest>) {
  const commuter = await seedAccount(t, {
    email: "method@example.com",
    name: "Method Rider",
    phone: "+639000000301",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "methoddriver@example.com",
    name: "Method Driver",
    phone: "+639000000302",
    role: "operator",
  });
  return { commuter, operator };
}

test("a booking stores the method the rider chose", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  const { rideId } = await t.action(api.rides.create, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    pickup: { ...PICKUP, address: "Pickup" },
    dropoff: { ...DROPOFF, address: "Dropoff" },
    vehicleType: "standard",
    paymentMethod: "maya",
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.paymentMethod).toBe("maya");
});

test("a booking without a method is booked as GCash, for the old builds", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  // The Android builds that predate the choice cannot send a method at all.
  // They are booked as GCash, which is what they were settled through.
  const { rideId } = await t.action(api.rides.create, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    pickup: { ...PICKUP, address: "Pickup" },
    dropoff: { ...DROPOFF, address: "Dropoff" },
    vehicleType: "standard",
    paymentMethod: undefined,
  } as never);

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.paymentMethod).toBe("gcash");
});

test("the charge uses the method the ride was booked with", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    status: "completed",
    paymentMethod: "maya",
  });

  const payment = await t.action(api.payments.charge, {
    sessionToken: commuter.sessionToken,
    rideId,
  });

  expect(payment.status).toBe("SETTLED");
  expect(payment.method).toBe("maya");

  const row = await t.run(async (ctx) =>
    ctx.db
      .query("payments")
      .withIndex("by_rideId", (q) => q.eq("rideId", rideId))
      .first()
  );
  expect(row?.provider).toBe("maya");
});

test("a ride booked with GCash settles as GCash", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    status: "completed",
    paymentMethod: "gcash",
  });

  const payment = await t.action(api.payments.charge, {
    sessionToken: commuter.sessionToken,
    rideId,
  });

  expect(payment.method).toBe("gcash");
});

test("a cash ride cannot be charged through the app", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    status: "completed",
    paymentMethod: "cash",
  });

  await expect(
    t.action(api.payments.charge, {
      sessionToken: commuter.sessionToken,
      rideId,
    })
  ).rejects.toThrow("paid in cash");
});

test("each wallet declines its own designated test number", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  const mayaRide = await seedRide(t, commuter.commuterId, {
    status: "completed",
    paymentMethod: "maya",
  });

  const declined = await t.action(api.payments.charge, {
    sessionToken: commuter.sessionToken,
    rideId: mayaRide,
    testNumber: MAYA_SANDBOX_DECLINE_NUMBER,
  });

  expect(declined.status).toBe("FAILED");
  expect(declined.failureReason).toBeDefined();
});

test("the GCash decline number does not affect Maya", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  const mayaRide = await seedRide(t, commuter.commuterId, {
    status: "completed",
    paymentMethod: "maya",
  });

  const payment = await t.action(api.payments.charge, {
    sessionToken: commuter.sessionToken,
    rideId: mayaRide,
    testNumber: GCASH_SANDBOX_DECLINE_NUMBER,
  });

  expect(payment.status).toBe("SETTLED");
});

test("a cash ride is settled by the driver's completion of it", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "inProgress",
    paymentMethod: "cash",
  });

  // The collection is confirmed by the driver, and their completion of a
  // cash ride is their word that it was collected. A build that predates the
  // confirmation cannot send the flag, and a cash trip it cannot close is a
  // trip that happened but could never be recorded.
  await markArrived(t, rideId);
  await t.mutation(api.rides.complete, {
    sessionToken: operator.sessionToken,
    id: rideId,
    operatorId: operator.operatorId,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("completed");
  expect(ride?.paymentStatus).toBe("paid");

  const payment = await t.run(async (ctx) =>
    ctx.db
      .query("payments")
      .withIndex("by_rideId", (q) => q.eq("rideId", rideId))
      .first()
  );
  expect(payment?.provider).toBe("cash");
  expect(payment?.status).toBe("SETTLED");
  expect(payment?.amount).toBe(ride?.fare);
});

test("a confirmed cash collection settles the ride in the same transaction", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "inProgress",
    paymentMethod: "cash",
  });

  await markArrived(t, rideId);
  await t.mutation(api.rides.complete, {
    sessionToken: operator.sessionToken,
    id: rideId,
    operatorId: operator.operatorId,
    cashCollected: true,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("completed");
  expect(ride?.paymentStatus).toBe("paid");
  expect(ride?.paidAt).toBeGreaterThan(0);

  const payment = await t.run(async (ctx) =>
    ctx.db
      .query("payments")
      .withIndex("by_rideId", (q) => q.eq("rideId", rideId))
      .first()
  );
  expect(payment?.provider).toBe("cash");
  expect(payment?.status).toBe("SETTLED");
  expect(payment?.amount).toBe(ride?.fare);
});

test("a cash ride never appears as owing money through the app", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  // It ended just now, so it is still waiting to be rated — but not paid.
  const rideId = await seedRide(t, commuter.commuterId, {
    completedAt: Date.now(),
    status: "completed",
    paymentMethod: "cash",
  });

  const trip = await t.query(api.rides.getTripNeedingAttention, {
    sessionToken: commuter.sessionToken,
  });

  expect(trip?.rideId).toBe(rideId);
  expect(trip?.needsPayment).toBe(false);
});

test("a wallet ride does appear as owing money", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  await seedRide(t, commuter.commuterId, {
    status: "completed",
    paymentMethod: "gcash",
  });

  const trip = await t.query(api.rides.getTripNeedingAttention, {
    sessionToken: commuter.sessionToken,
  });

  expect(trip?.needsPayment).toBe(true);
});

test("the due query reports the method the ride was booked with", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  await seedRide(t, commuter.commuterId, {
    status: "completed",
    paymentMethod: "cash",
  });

  const due = await t.query(api.payments.getDue, {
    sessionToken: commuter.sessionToken,
  });

  expect(due?.method).toBe("cash");
});

test("a ride that predates the choice still settles as GCash", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  const rideId = await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("rides", {
      commuterId: commuter.commuterId,
      pickup: { ...PICKUP, address: "Pickup" },
      dropoff: { ...DROPOFF, address: "Dropoff" },
      vehicleType: "standard",
      status: "completed",
      fare: 30,
      distance: 5,
      paymentStatus: "unpaid",
      createdAt: now,
      updatedAt: now,
    });
  });

  const payment = await t.action(api.payments.charge, {
    sessionToken: commuter.sessionToken,
    rideId,
  });

  expect(payment.method).toBe("gcash");
});

test("the repair marks the live rides that predate the choice as GCash", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  const rideId = await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("rides", {
      commuterId: commuter.commuterId,
      pickup: { ...PICKUP, address: "Pickup" },
      dropoff: { ...DROPOFF, address: "Dropoff" },
      vehicleType: "standard",
      status: "pending",
      fare: 30,
      distance: 5,
      paymentStatus: "unpaid",
      createdAt: now,
      updatedAt: now,
    });
  });

  const result = await t.mutation(internal.repair.paymentMethod, {});
  expect(result.backfilled).toBe(1);

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.paymentMethod).toBe("gcash");
});
