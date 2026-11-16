import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createTest, markArrived, seedAccount, seedRide } from "./helpers";

/**
 * The Android builds that are already on phones.
 *
 * An APK carries the web code as bundled assets, so its screens are frozen
 * at build time and it cannot be changed. What it *can* do is call the
 * server, and `fixoct38` made three of the calls it makes fail. These
 * assertions are the shape of the old client, and they are what would have
 * caught the break before it shipped.
 */

const PICKUP = { latitude: 14.5995, longitude: 120.9842 };
const DROPOFF = { latitude: 14.65, longitude: 121.05 };

async function seedPair(t: ReturnType<typeof createTest>) {
  const commuter = await seedAccount(t, {
    email: "legacy-rider@example.com",
    name: "Louie Igop",
    phone: "+639000000501",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "legacy-driver@example.com",
    name: "John Doe",
    phone: "+639000000502",
    role: "operator",
  });
  return { commuter, operator };
}

test("a booking that sends no method is booked as GCash", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  // The old build's call, verbatim: no `paymentMethod`.
  const { rideId } = await t.action(api.rides.create, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    pickup: { ...PICKUP, address: "Pickup" },
    dropoff: { ...DROPOFF, address: "Dropoff" },
    vehicleType: "standard",
  } as never);

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.paymentMethod).toBe("gcash");
});

test("a booking that sends a method is still booked with it", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  const { rideId } = await t.action(api.rides.create, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    pickup: { ...PICKUP, address: "Pickup" },
    dropoff: { ...DROPOFF, address: "Dropoff" },
    vehicleType: "standard",
    paymentMethod: "cash",
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.paymentMethod).toBe("cash");
});

test("a booking that sends an invented method is still refused", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  await expect(
    t.action(api.rides.create, {
      sessionToken: commuter.sessionToken,
      commuterId: commuter.commuterId,
      pickup: { ...PICKUP, address: "Pickup" },
      dropoff: { ...DROPOFF, address: "Dropoff" },
      vehicleType: "standard",
      paymentMethod: "barter",
    } as never)
  ).rejects.toThrow();
});

// fixoct45: the driver can no longer start a ride the passenger never
// confirmed — not from the new screen, and not from an old build either.
test("the driver cannot start a ride the passenger never confirmed", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  // The old build's "Picked up", or the new build's greyed-out "Start trip".
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
});

test("the driver's fallback on a ride already under way succeeds", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  // The passenger confirms, and the driver then taps "Picked up" on a build
  // that does not know the passenger starts the trip. The tap lands on a ride
  // that is already running, and it has to succeed.
  await t.mutation(api.rides.confirm, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });

  await t.mutation(api.rides.updateStatus, {
    sessionToken: operator.sessionToken,
    id: rideId,
    status: "inProgress",
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("inProgress");
  expect(ride?.confirmedAt).toBeGreaterThan(0);
});

test("a refused early start does not block the passenger's confirmation", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  // The driver tries to start it first, and is refused.
  await expect(
    t.mutation(api.rides.updateStatus, {
      sessionToken: operator.sessionToken,
      id: rideId,
      status: "inProgress",
    })
  ).rejects.toThrow("has not confirmed");

  // Then the passenger confirms, and the trip starts.
  await t.mutation(api.rides.confirm, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("inProgress");
  expect(ride?.confirmedAt).toBeGreaterThan(0);
});

test("a cash ride can be closed by a build that does not confirm the collection", async () => {
  const t = createTest();
  const { commuter, operator } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "inProgress",
    paymentMethod: "cash",
  });

  // The old build's "Complete": no `cashCollected`.
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

  // The driver never said so explicitly, and that is recorded.
  expect(ride?.cashCollectedAt).toBeUndefined();
});

test("a driver who confirms the collection has it recorded", async () => {
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
  expect(ride?.cashCollectedAt).toBeGreaterThan(0);
});

test("a legacy rider can still pay for the trip they took", async () => {
  const t = createTest();
  const { commuter } = await seedPair(t);

  const rideId = await seedRide(t, commuter.commuterId, {
    status: "completed",
    paymentMethod: "gcash",
  });

  // The old build's call: no method, just the ride and the number.
  const payment = await t.action(api.payments.charge, {
    sessionToken: commuter.sessionToken,
    rideId,
  });

  expect(payment.status).toBe("SETTLED");
  expect(payment.method).toBe("gcash");
});
