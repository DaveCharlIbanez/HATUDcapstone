import { expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { FARE_RATES, quoteFare } from "../../convex/lib/fare";
import { estimateRoadKm, haversineKm } from "../../convex/lib/routing";
import { createTest, seedAccount, seedRide } from "./helpers";

const PICKUP = { latitude: 14.5995, longitude: 120.9842 };
const DROPOFF = { latitude: 14.65, longitude: 121.05 };

test("a trip inside the included distance costs the base fare", () => {
  const quote = quoteFare("standard", 1.4);
  expect(quote.fare).toBe(30);
  expect(quote.meteredKm).toBe(0);
  expect(quote.meteredAmount).toBe(0);
});

test("the meter starts beyond the included distance and rounds up per kilometre", () => {
  const quote = quoteFare("standard", 5.2);
  expect(quote.meteredKm).toBe(4);
  expect(quote.meteredAmount).toBe(48);
  expect(quote.fare).toBe(78);
});

test("a fraction of a kilometre still bills a whole kilometre", () => {
  const quote = quoteFare("standard", 2.1);
  expect(quote.meteredKm).toBe(1);
  expect(quote.fare).toBe(42);
});

test("the tariff is thirty pesos and twelve a kilometre", () => {
  expect(FARE_RATES.standard.base).toBe(30);
  expect(FARE_RATES.standard.perKm).toBe(12);
  expect(FARE_RATES.standard.includedKm).toBe(2);
});

test("there is one ride type, and it has one tariff", () => {
  expect(Object.keys(FARE_RATES)).toEqual(["standard"]);
});

test("the estimated road distance is greater than the straight-line distance", () => {
  const straight = haversineKm(PICKUP, DROPOFF);
  const road = estimateRoadKm(PICKUP, DROPOFF);
  expect(road).toBeGreaterThan(straight);
  expect(road).toBeCloseTo(straight * 1.18, 2);
});

test("a ride stores the server-computed fare and ignores the client's", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "fare@example.com",
    name: "Fare Passer",
    phone: "+639000000101",
    role: "commuter",
  });

  const { rideId } = await t.action(api.rides.create, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    pickup: { ...PICKUP, address: "Pickup" },
    dropoff: { ...DROPOFF, address: "Dropoff" },
    vehicleType: "standard",
    paymentMethod: "gcash",
    // A client trying to pay ₱1.
    fare: 1,
    distance: 9999,
  });

  // The router is stubbed to report five kilometres.
  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.distance).toBe(5);
  expect(ride?.fare).toBe(quoteFare("standard", 5).fare);
  expect(ride?.fare).not.toBe(1);
});

test("a booking that asks for the old Priority ride is booked as the one that exists", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "legacy-priority@example.com",
    name: "Legacy Booker",
    phone: "+639000000110",
    role: "commuter",
  });

  // The Android builds that predate the single ride type still send
  // "priority". There is no Priority ride any more, and they are booked as
  // the ride that exists — at the fare they were quoted.
  const { rideId } = await t.action(api.rides.create, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    pickup: { ...PICKUP, address: "Pickup" },
    dropoff: { ...DROPOFF, address: "Dropoff" },
    vehicleType: "priority",
    paymentMethod: "gcash",
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.vehicleType).toBe("standard");
});

test("a booking without a ride type is booked as the one that exists", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "no-type@example.com",
    name: "Type-less Booker",
    phone: "+639000000111",
    role: "commuter",
  });

  // There is one ride type, so it is not a parameter the rider chooses: the
  // client does not send it at all.
  const { rideId } = await t.action(api.rides.create, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    pickup: { ...PICKUP, address: "Pickup" },
    dropoff: { ...DROPOFF, address: "Dropoff" },
    paymentMethod: "gcash",
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.vehicleType).toBe("standard");
});

test("the quote matches the fare the ride is created with", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "quote@example.com",
    name: "Quote Passer",
    phone: "+639000000102",
    role: "commuter",
  });

  const quote = await t.action(api.rides.quoteFare, {
    sessionToken: commuter.sessionToken,
    pickup: PICKUP,
    dropoff: DROPOFF,
  });

  const { rideId } = await t.action(api.rides.create, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    pickup: { ...PICKUP, address: "Pickup" },
    dropoff: { ...DROPOFF, address: "Dropoff" },
    paymentMethod: "gcash",
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.fare).toBe(quote.standard.fare);
  // The quote and the booking are charged on the same measurement.
  expect(quote.distanceKm).toBe(5);
  expect(ride?.distance).toBe(quote.distanceKm);
});

test("a driver cannot accept a second ride while one is live", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "booker@example.com",
    name: "Booker",
    phone: "+639000000103",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "busy@example.com",
    name: "Busy Driver",
    phone: "+639000000104",
    role: "operator",
  });

  const firstRide = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });
  const secondRide = await seedRide(t, commuter.commuterId);

  await expect(
    t.mutation(api.rides.accept, {
      sessionToken: operator.sessionToken,
      id: secondRide,
      operatorId: operator.operatorId,
    })
  ).rejects.toThrow("Finish your current ride before taking another.");

  // The live ride is untouched by the rejected attempt.
  const ride = await t.run(async (ctx) => await ctx.db.get(firstRide));
  expect(ride?.status).toBe("accepted");
});

test("a driver who is offline cannot accept a ride", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "booker2@example.com",
    name: "Booker Two",
    phone: "+639000000105",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "offline@example.com",
    name: "Offline Driver",
    phone: "+639000000106",
    role: "operator",
  });

  await t.run(async (ctx) => {
    await ctx.db.patch(operator.operatorId, { isAvailable: false });
  });

  const rideId = await seedRide(t, commuter.commuterId);

  await expect(
    t.mutation(api.rides.accept, {
      sessionToken: operator.sessionToken,
      id: rideId,
      operatorId: operator.operatorId,
    })
  ).rejects.toThrow("Go online to start taking rides.");
});

test("cancelling a ride leaves the driver's shift alone", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "canceller@example.com",
    name: "Canceller",
    phone: "+639000000107",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "released@example.com",
    name: "Released Driver",
    phone: "+639000000108",
    role: "operator",
  });

  const rideId = await seedRide(t, commuter.commuterId, {
    // Inside the passenger's 1-minute cancel window (fixoct46).
    acceptedAt: Date.now(),
    operatorId: operator.operatorId,
    status: "accepted",
  });

  await t.run(async (ctx) => {
    await ctx.db.patch(operator.operatorId, { isAvailable: false });
  });

  await t.mutation(api.rides.cancel, {
    sessionToken: commuter.sessionToken,
    id: rideId,
  });

  // The shift is the driver's own decision. Cancelling a ride used to put
  // them back on shift, which meant a driver could never actually go offline.
  const afterCancel = await t.run(
    async (ctx) => await ctx.db.get(operator.operatorId)
  );
  expect(afterCancel?.isAvailable).toBe(false);
});

test("the session purge removes expired and revoked sessions only", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "sessions@example.com",
    name: "Session Owner",
    phone: "+639000000109",
    role: "commuter",
  });

  await t.run(async (ctx) => {
    const sessions = await ctx.db.query("sessions").collect();
    const first = sessions[0];
    if (first) {
      await ctx.db.patch(first._id, { expiresAt: Date.now() - 1 });
    }
    await ctx.db.insert("sessions", {
      userId: commuter.userId,
      token: "revoked-token",
      expiresAt: Date.now() + 100_000,
      createdAt: Date.now(),
      isRevoked: true,
    });
    await ctx.db.insert("sessions", {
      userId: commuter.userId,
      token: "live-token",
      expiresAt: Date.now() + 100_000,
      createdAt: Date.now(),
      isRevoked: false,
    });
  });

  await t.mutation(internal.crons.purgeExpiredSessions, {});

  const remaining = await t.run(async (ctx) => {
    const sessions = await ctx.db.query("sessions").collect();
    return sessions.map((session) => session.token);
  });

  expect(remaining).toEqual(["live-token"]);
});
