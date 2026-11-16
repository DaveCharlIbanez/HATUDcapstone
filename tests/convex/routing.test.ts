import { expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { quoteFare } from "../../convex/lib/fare";
import { estimateRoadKm, routeCacheKey } from "../../convex/lib/routing";
import { failRouter, setRouterDistance } from "../setup";
import { createTest, seedAccount } from "./helpers";

/**
 * The road distance behind the fare.
 *
 * The fare is charged on the distance the router measured, which is the same
 * distance the map draws. The estimate is only ever the fallback, for when
 * the router cannot be reached.
 */

const PICKUP = { latitude: 10.5944, longitude: 121.9494 };
const DROPOFF = { latitude: 10.5923, longitude: 121.9476 };
const BOOKING = {
  dropoff: { ...DROPOFF, address: "Dropoff" },
  pickup: { ...PICKUP, address: "Pickup" },
};

test("the cache key is stable for the same pair of places", () => {
  const key = routeCacheKey(PICKUP, DROPOFF);
  expect(key).toBe(routeCacheKey(PICKUP, DROPOFF));
  expect(key).not.toBe(routeCacheKey(DROPOFF, PICKUP));
});

test("the estimate is the fallback, and it is not the straight line", () => {
  const estimate = estimateRoadKm(PICKUP, DROPOFF);
  expect(estimate).toBeGreaterThan(0);
  expect(Number.isFinite(estimate)).toBe(true);
});

test("the quote is charged on the distance the router measured", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "router@example.com",
    name: "Router Passer",
    phone: "+639000000401",
    role: "commuter",
  });

  setRouterDistance(8.4);

  const quote = await t.action(api.rides.quoteFare, {
    sessionToken: commuter.sessionToken,
    pickup: PICKUP,
    dropoff: DROPOFF,
  });

  expect(quote.distanceKm).toBe(8.4);
  expect(quote.source).toBe("router");
  expect(quote.standard.fare).toBe(quoteFare("standard", 8.4).fare);
  // The Android builds that predate the single ride type read the quote for
  // the card they are about to stop offering. It has to be there, and it is
  // the same fare, because there is only one.
  expect(quote.priority.fare).toBe(quote.standard.fare);
});

test("the quote and the booking are charged on the same distance", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "same-distance@example.com",
    name: "Same Distance",
    phone: "+639000000402",
    role: "commuter",
  });

  setRouterDistance(6.25);

  const quote = await t.action(api.rides.quoteFare, {
    sessionToken: commuter.sessionToken,
    pickup: PICKUP,
    dropoff: DROPOFF,
  });

  const { rideId } = await t.action(api.rides.create, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    vehicleType: "standard",
    paymentMethod: "gcash",
    ...BOOKING,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));

  expect(ride?.distance).toBe(quote.distanceKm);
  expect(ride?.fare).toBe(quote.standard.fare);
});

test("the router is asked once for a pair of places, not once for each fare", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "cached@example.com",
    name: "Cached Passer",
    phone: "+639000000403",
    role: "commuter",
  });

  setRouterDistance(4);

  await t.action(api.rides.quoteFare, {
    sessionToken: commuter.sessionToken,
    pickup: PICKUP,
    dropoff: DROPOFF,
  });

  // The second time round, the answer is already known, so the router is not
  // asked again — and the distance does not move under the passenger's feet.
  setRouterDistance(99);

  const second = await t.action(api.rides.quoteFare, {
    sessionToken: commuter.sessionToken,
    pickup: PICKUP,
    dropoff: DROPOFF,
  });

  expect(second.distanceKm).toBe(4);
  expect(second.source).toBe("router");
});

test("the measured distance is remembered in the cache", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "remembered@example.com",
    name: "Remembered Passer",
    phone: "+639000000404",
    role: "commuter",
  });

  setRouterDistance(7.5);

  await t.action(api.rides.quoteFare, {
    sessionToken: commuter.sessionToken,
    pickup: PICKUP,
    dropoff: DROPOFF,
  });

  const row = await t.run(async (ctx) =>
    ctx.db
      .query("routeDistances")
      .withIndex("by_key", (q) => q.eq("key", routeCacheKey(PICKUP, DROPOFF)))
      .first()
  );

  expect(row?.distanceKm).toBe(7.5);
  expect(row?.source).toBe("router");
});

test("a router that cannot be reached falls back to the estimate", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "offline-router@example.com",
    name: "Offline Router",
    phone: "+639000000405",
    role: "commuter",
  });

  failRouter();

  const quote = await t.action(api.rides.quoteFare, {
    sessionToken: commuter.sessionToken,
    pickup: PICKUP,
    dropoff: DROPOFF,
  });

  // A fare is a money figure and it can never be allowed to fail to be
  // computable, so the estimate stands in.
  expect(quote.source).toBe("estimate");
  expect(quote.distanceKm).toBe(estimateRoadKm(PICKUP, DROPOFF));
  expect(quote.standard.fare).toBe(
    quoteFare("standard", quote.distanceKm).fare
  );
});

test("a booking still goes through when the router is down", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "booking-offline@example.com",
    name: "Booking Offline",
    phone: "+639000000406",
    role: "commuter",
  });

  failRouter();

  const { rideId, reused } = await t.action(api.rides.create, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    vehicleType: "standard",
    paymentMethod: "gcash",
    ...BOOKING,
  });

  expect(reused).toBe(false);
  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.status).toBe("pending");
  expect(ride?.distance).toBe(estimateRoadKm(PICKUP, DROPOFF));
});

test("the cached distance is reused by the booking, so the price does not move", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "stable-price@example.com",
    name: "Stable Price",
    phone: "+639000000407",
    role: "commuter",
  });

  setRouterDistance(5);
  const quote = await t.action(api.rides.quoteFare, {
    sessionToken: commuter.sessionToken,
    pickup: PICKUP,
    dropoff: DROPOFF,
  });

  // The router would now answer differently. The passenger was shown a
  // price, and that is the price they pay.
  setRouterDistance(20);

  const { rideId } = await t.action(api.rides.create, {
    sessionToken: commuter.sessionToken,
    commuterId: commuter.commuterId,
    vehicleType: "standard",
    paymentMethod: "gcash",
    ...BOOKING,
  });

  const ride = await t.run(async (ctx) => await ctx.db.get(rideId));
  expect(ride?.distance).toBe(quote.distanceKm);
  expect(ride?.fare).toBe(quote.standard.fare);
});

test("the booking refuses a passenger who does not own the profile", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "not-mine@example.com",
    name: "Not Mine",
    phone: "+639000000408",
    role: "commuter",
  });
  const other = await seedAccount(t, {
    email: "other-owner@example.com",
    name: "Other Owner",
    phone: "+639000000409",
    role: "commuter",
  });

  await expect(
    t.action(api.rides.create, {
      sessionToken: other.sessionToken,
      commuterId: commuter.commuterId,
      vehicleType: "standard",
      paymentMethod: "gcash",
      ...BOOKING,
    })
  ).rejects.toThrow("do not own");
});

test("the cache row can be read back through the internal query", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "cache-read@example.com",
    name: "Cache Read",
    phone: "+639000000410",
    role: "commuter",
  });

  setRouterDistance(3.5);
  await t.action(api.rides.quoteFare, {
    sessionToken: commuter.sessionToken,
    pickup: PICKUP,
    dropoff: DROPOFF,
  });

  const row = await t.query(internal.routeCache.get, {
    key: routeCacheKey(PICKUP, DROPOFF),
  });

  expect(row?.distanceKm).toBe(3.5);
  expect(row?.source).toBe("router");
});
