import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createTest, seedAccount, seedRide } from "./helpers";

test("a rider profile carries the signed-in rider's own details", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "rider@example.com",
    name: "Rider One",
    phone: "+639000000201",
    role: "commuter",
  });
  const other = await seedAccount(t, {
    email: "other-rider@example.com",
    name: "Rider Two",
    phone: "+639000000202",
    role: "commuter",
  });

  const profile = await t.query(api.profile.commuterProfile, {
    sessionToken: commuter.sessionToken,
  });

  expect(profile.name).toBe("Rider One");
  expect(profile.email).toBe("rider@example.com");
  expect(profile.phone).toBe("+639000000201");

  const otherProfile = await t.query(api.profile.commuterProfile, {
    sessionToken: other.sessionToken,
  });
  expect(otherProfile.name).toBe("Rider Two");
  expect(otherProfile.id).not.toBe(profile.id);
});

test("a rider profile counts only their own completed rides and settled payments", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "counter@example.com",
    name: "Counter",
    phone: "+639000000203",
    role: "commuter",
  });
  const stranger = await seedAccount(t, {
    email: "stranger-rider@example.com",
    name: "Stranger",
    phone: "+639000000204",
    role: "commuter",
  });

  const ownRide = await seedRide(t, commuter.commuterId, {
    status: "completed",
  });
  await seedRide(t, commuter.commuterId, { status: "cancelled" });
  // A second completed ride that was never charged: the total spent still
  // counts it, because it is the value of the rides the passenger has taken.
  await seedRide(t, commuter.commuterId, { status: "completed" });
  await seedRide(t, stranger.commuterId, { status: "completed" });

  await t.run(async (ctx) => {
    await ctx.db.insert("payments", {
      rideId: ownRide,
      commuterId: commuter.commuterId,
      amount: 30,
      currency: "PHP",
      provider: "gcash",
      providerRef: "tx-profile-1",
      referenceNumber: "HATUD-PROFILE-1",
      status: "SETTLED",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  const profile = await t.query(api.profile.commuterProfile, {
    sessionToken: commuter.sessionToken,
  });

  expect(profile.completedRides).toBe(2);
  expect(profile.totalSpent).toBe(60);
  expect(profile.payments).toHaveLength(1);
  expect(profile.history).toHaveLength(3);
  expect(profile.history[0]?.pickupAddress).toBe("Pickup Point");
});

test("a driver profile carries the signed-in driver's own vehicle and licence", async () => {
  const t = createTest();
  const operator = await seedAccount(t, {
    email: "driver@example.com",
    name: "Driver One",
    phone: "+639000000205",
    role: "operator",
  });

  const profile = await t.query(api.profile.operatorProfile, {
    sessionToken: operator.sessionToken,
  });

  expect(profile.name).toBe("Driver One");
  expect(profile.email).toBe("driver@example.com");
  expect(profile.phone).toBe("+639000000205");
  expect(profile.licenseNumber).toBe("LIC-driver@example.com");
  expect(profile.vehicleInfo.plateNumber).toBe("ABC 123");
});

test("a driver profile totals earnings and rating from their own rides", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "ratee@example.com",
    name: "Ratee",
    phone: "+639000000206",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "rated-driver@example.com",
    name: "Rated Driver",
    phone: "+639000000207",
    role: "operator",
  });

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "completed",
  });

  await t.mutation(api.feedback.create, {
    sessionToken: commuter.sessionToken,
    rideId,
    commuterId: commuter.commuterId,
    rating: 4,
  });

  const profile = await t.query(api.profile.operatorProfile, {
    sessionToken: operator.sessionToken,
  });

  expect(profile.completedRides).toBe(1);
  expect(profile.totalEarnings).toBe(30);
  expect(profile.averageRating).toBe(4);
  expect(profile.ratingCount).toBe(1);
  expect(profile.history[0]?.commuterName).toBe("Ratee");
});

test("a rider cannot read a driver profile and a driver cannot read a rider profile", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "crossed-rider@example.com",
    name: "Crossed Rider",
    phone: "+639000000208",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "crossed-driver@example.com",
    name: "Crossed Driver",
    phone: "+639000000209",
    role: "operator",
  });

  await expect(
    t.query(api.profile.operatorProfile, {
      sessionToken: commuter.sessionToken,
    })
  ).rejects.toThrow("Forbidden");
  await expect(
    t.query(api.profile.commuterProfile, {
      sessionToken: operator.sessionToken,
    })
  ).rejects.toThrow("Forbidden");
});

test("a profile query rejects a token that is not present", async () => {
  const t = createTest();

  await expect(
    t.query(api.profile.commuterProfile, { sessionToken: "not-a-session" })
  ).rejects.toThrow("Unauthorized");
});

test("a rider cannot blank out their own name", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "blanker@example.com",
    name: "Blanker",
    phone: "+639000000210",
    role: "commuter",
  });

  await expect(
    t.mutation(api.commuters.update, {
      sessionToken: commuter.sessionToken,
      id: commuter.commuterId,
      name: "   ",
    })
  ).rejects.toThrow("Name cannot be empty");
});
