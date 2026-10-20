import { expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import {
  FARE_RATES,
  haversineKm,
  quoteFare,
  quoteForTrip,
  roadDistanceKm,
} from "../../convex/lib/fare";
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
  expect(quote.meteredAmount).toBe(40);
  expect(quote.fare).toBe(70);
});

test("a fraction of a kilometre still bills a whole kilometre", () => {
  const quote = quoteFare("standard", 2.1);
  expect(quote.meteredKm).toBe(1);
  expect(quote.fare).toBe(40);
});

test("the priority tariff is higher on both the base fee and the meter", () => {
  expect(FARE_RATES.priority.base).toBeGreaterThan(FARE_RATES.standard.base);
  expect(FARE_RATES.priority.perKm).toBeGreaterThan(FARE_RATES.standard.perKm);
  expect(quoteFare("priority", 5.2).fare).toBeGreaterThan(
    quoteFare("standard", 5.2).fare
  );
});

test("the road distance is greater than the straight-line distance", () => {
  const straight = haversineKm(PICKUP, DROPOFF);
  const road = roadDistanceKm(PICKUP, DROPOFF);
  expect(road).toBeGreaterThan(straight);
  expect(road).toBeCloseTo(straight * 1.3, 2);
});

test("a ride stores the server-computed fare and ignores the client's", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "fare@example.com",
    name: "Fare Passer",
    phone: "+639000000101",
    role: "commuter",
  });

  const expected = quoteForTrip("standard", PICKUP, DROPOFF);

  const rideId = await t.mutation(api.rides.create, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    pickup: { ...PICKUP, address: "Pickup" },
    dropoff: { ...DROPOFF, address: "Dropoff" },
    vehicleType: "standard",
    // A client trying to pay ₱1.
    fare: 1,
    distance: 9999,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.fare).toBe(expected.fare);
  expect(ride?.distance).toBe(expected.distanceKm);
  expect(ride?.fare).not.toBe(1);
});

test("the quote matches the fare the ride is created with", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "quote@example.com",
    name: "Quote Passer",
    phone: "+639000000102",
    role: "commuter",
  });

  const quote = await t.query(api.rides.getFareQuote, {
    sessionToken: commuter.sessionToken,
    pickup: PICKUP,
    dropoff: DROPOFF,
  });

  const rideId = await t.mutation(api.rides.create, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    pickup: { ...PICKUP, address: "Pickup" },
    dropoff: { ...DROPOFF, address: "Dropoff" },
    vehicleType: "priority",
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.fare).toBe(quote.priority.fare);
  expect(quote.standard.fare).toBeLessThan(quote.priority.fare);
  expect(quote.distanceKm).toBe(roadDistanceKm(PICKUP, DROPOFF));
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
  ).rejects.toThrow("You already have an active ride");

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
  ).rejects.toThrow("You must be online to accept a ride");
});

test("cancelling a ride releases the driver", async () => {
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

  const released = await t.run(
    async (ctx) => await ctx.db.get(operator.operatorId)
  );
  expect(released?.isAvailable).toBe(true);
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
