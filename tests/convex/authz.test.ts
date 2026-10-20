import { expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { createTest, seedAccount, seedRide } from "./helpers";

test("a commuter can read their own profile but not an operator's", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "commuter@example.com",
    name: "Commuter",
    phone: "+639000000001",
    role: "commuter",
  });

  const own = await t.query(api.commuters.getSelf, {
    sessionToken: commuter.sessionToken,
  });
  expect(own?.name).toBe("Commuter");
  expect(own?.email).toBe("commuter@example.com");

  await expect(
    t.query(api.operators.getSelf, { sessionToken: commuter.sessionToken })
  ).rejects.toThrow("Forbidden");
});

test("an operator can read their own profile but not a commuter's", async () => {
  const t = createTest();
  const operator = await seedAccount(t, {
    email: "operator@example.com",
    name: "Operator",
    phone: "+639000000002",
    role: "operator",
  });

  const own = await t.query(api.operators.getSelf, {
    sessionToken: operator.sessionToken,
  });
  expect(own?.name).toBe("Operator");
  expect(own?.licenseNumber).toBe("LIC-operator@example.com");

  await expect(
    t.query(api.commuters.getSelf, { sessionToken: operator.sessionToken })
  ).rejects.toThrow("Forbidden");
});

test("scoped queries reject a token that is not present", async () => {
  const t = createTest();

  await expect(
    t.query(api.commuters.getSelf, { sessionToken: "not-a-session" })
  ).rejects.toThrow("Unauthorized");
});

test("a commuter sees only their own active ride and a projected driver", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "commuter2@example.com",
    name: "Commuter Two",
    phone: "+639000000003",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "operator2@example.com",
    name: "Operator Two",
    phone: "+639000000004",
    role: "operator",
  });

  await seedRide(t, commuter.commuterId as never, {
    operatorId: operator.operatorId as never,
    status: "accepted",
  });

  const active = await t.query(api.rides.getActiveForMe, {
    sessionToken: commuter.sessionToken,
  });

  expect(active?.ride.status).toBe("accepted");
  expect(active?.partner?.kind).toBe("operator");
  if (active?.partner?.kind === "operator") {
    expect(active.partner.name).toBe("Operator Two");
    expect(active.partner.vehicleInfo.plateNumber).toBe("ABC 123");
    // The driver counterpart view must not carry the licence number or phone.
    expect(active.partner).not.toHaveProperty("licenseNumber");
    expect(active.partner).not.toHaveProperty("phone");
    expect(active.partner).not.toHaveProperty("currentLocation");
  }
});

test("a driver sees a projected passenger, without email or saved addresses", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "commuter3@example.com",
    name: "Commuter Three",
    phone: "+639000000005",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "operator3@example.com",
    name: "Operator Three",
    phone: "+639000000006",
    role: "operator",
  });

  await seedRide(t, commuter.commuterId as never, {
    operatorId: operator.operatorId as never,
    status: "accepted",
  });

  const active = await t.query(api.rides.getActiveForMe, {
    sessionToken: operator.sessionToken,
  });

  expect(active?.partner?.kind).toBe("commuter");
  if (active?.partner?.kind === "commuter") {
    expect(active.partner.name).toBe("Commuter Three");
    expect(active.partner.phone).toBe("+639000000005");
    expect(active.partner).not.toHaveProperty("email");
    expect(active.partner).not.toHaveProperty("savedLocations");
  }
});

test("a driver cannot read a ride they are not assigned to", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "commuter4@example.com",
    name: "Commuter Four",
    phone: "+639000000007",
    role: "commuter",
  });
  const assigned = await seedAccount(t, {
    email: "assigned@example.com",
    name: "Assigned",
    phone: "+639000000008",
    role: "operator",
  });
  const stranger = await seedAccount(t, {
    email: "stranger@example.com",
    name: "Stranger",
    phone: "+639000000009",
    role: "operator",
  });

  const rideId = await seedRide(t, commuter.commuterId as never, {
    operatorId: assigned.operatorId as never,
    status: "accepted",
  });

  await expect(
    t.query(api.rides.getPartnerLocation, {
      sessionToken: stranger.sessionToken,
      rideId,
    })
  ).rejects.toThrow("Forbidden");
});

test("a commuter cannot read the location of a ride that is not theirs", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "commuter5@example.com",
    name: "Commuter Five",
    phone: "+639000000010",
    role: "commuter",
  });
  const other = await seedAccount(t, {
    email: "other@example.com",
    name: "Other",
    phone: "+639000000011",
    role: "commuter",
  });

  const rideId = await seedRide(t, other.commuterId as never);

  await expect(
    t.query(api.rides.getPartnerLocation, {
      sessionToken: commuter.sessionToken,
      rideId,
    })
  ).rejects.toThrow("Forbidden");
});

test("only operators may list pending rides", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "commuter6@example.com",
    name: "Commuter Six",
    phone: "+639000000012",
    role: "commuter",
  });

  await expect(
    t.query(api.rides.listPendingWithCommuter, {
      sessionToken: commuter.sessionToken,
    })
  ).rejects.toThrow("Forbidden");
});

test("the pending-ride list projects the passenger to name and phone only", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "commuter7@example.com",
    name: "Commuter Seven",
    phone: "+639000000013",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "operator7@example.com",
    name: "Operator Seven",
    phone: "+639000000014",
    role: "operator",
  });

  await seedRide(t, commuter.commuterId as never, {
    operatorId: operator.operatorId as never,
  });

  const pending = await t.query(api.rides.listPendingWithCommuter, {
    sessionToken: operator.sessionToken,
  });

  expect(pending.length).toBe(1);
  const entry = pending[0];
  expect(entry?.commuter?.name).toBe("Commuter Seven");
  expect(entry?.commuter?.phone).toBe("+639000000013");
  expect(entry?.commuter).not.toHaveProperty("email");
  expect(entry?.commuter).not.toHaveProperty("savedLocations");
});

test("legacy reads never expose saved addresses, licence numbers or phones", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "legacy@example.com",
    name: "Legacy Commuter",
    phone: "+639000000015",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "legacy-operator@example.com",
    name: "Legacy Operator",
    phone: "+639000000016",
    role: "operator",
  });
  const rideId = await seedRide(t, commuter.commuterId as never, {
    operatorId: operator.operatorId as never,
    status: "accepted",
  });

  // No session token at all — the shape an already-exported APK produces.
  const legacyCommuter = await t.query(api.commuters.getByUserId, {
    userId: commuter.userId,
  });
  expect(legacyCommuter?.name).toBe("Legacy Commuter");
  expect(legacyCommuter).not.toHaveProperty("email");
  expect(legacyCommuter).not.toHaveProperty("savedLocations");

  const legacyOperator = await t.query(api.operators.getByUserId, {
    userId: operator.userId,
  });
  expect(legacyOperator?.name).toBe("Legacy Operator");
  expect(legacyOperator).not.toHaveProperty("licenseNumber");
  expect(legacyOperator).not.toHaveProperty("phone");
  expect(legacyOperator).not.toHaveProperty("currentLocation");

  const legacyById = await t.query(api.operators.getById, {
    id: operator.operatorId as never,
  });
  expect(legacyById?.name).toBe("Legacy Operator");
  expect(legacyById).not.toHaveProperty("licenseNumber");
  expect(legacyById).not.toHaveProperty("currentLocation");

  const legacyCommuterById = await t.query(api.commuters.getById, {
    id: commuter.commuterId as never,
  });
  expect(legacyCommuterById?.name).toBe("Legacy Commuter");
  expect(legacyCommuterById).not.toHaveProperty("email");
  expect(legacyCommuterById).not.toHaveProperty("savedLocations");

  const legacyLocation = await t.query(api.rides.getCommuterLocation, {
    rideId,
  });
  expect(legacyLocation).toBeNull();
});

test("a token that is present but invalid never falls back to the legacy path", async () => {
  const t = createTest();
  const operator = await seedAccount(t, {
    email: "strict@example.com",
    name: "Strict",
    phone: "+639000000017",
    role: "operator",
  });

  await expect(
    t.query(api.operators.getByUserId, {
      userId: operator.userId,
      sessionToken: "expired-or-revoked",
    })
  ).rejects.toThrow("Unauthorized");
});

test("seeding refuses to run without the deployment seed key", async () => {
  const t = createTest();

  await expect(
    t.mutation(internal.seed.forceReset, { seedKey: "guess" })
  ).rejects.toThrow("SEED_KEY");
});

test("feedback can only be left by the passenger on a completed ride", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "rater@example.com",
    name: "Rater",
    phone: "+639000000018",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "rated@example.com",
    name: "Rated",
    phone: "+639000000019",
    role: "operator",
  });

  const pendingRide = await seedRide(t, commuter.commuterId as never, {
    operatorId: operator.operatorId as never,
    status: "pending",
  });

  await expect(
    t.mutation(api.feedback.create, {
      sessionToken: commuter.sessionToken,
      rideId: pendingRide,
      commuterId: commuter.commuterId as never,
      rating: 5,
    })
  ).rejects.toThrow("completed");
});

test("feedback derives the driver from the ride, not from the client", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "rater2@example.com",
    name: "Rater Two",
    phone: "+639000000020",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "rated2@example.com",
    name: "Rated Two",
    phone: "+639000000021",
    role: "operator",
  });
  const otherOperator = await seedAccount(t, {
    email: "other-rated@example.com",
    name: "Other Rated",
    phone: "+639000000022",
    role: "operator",
  });

  const rideId = await seedRide(t, commuter.commuterId as never, {
    operatorId: operator.operatorId as never,
    status: "completed",
  });

  const feedbackId = await t.mutation(api.feedback.create, {
    sessionToken: commuter.sessionToken,
    rideId,
    commuterId: commuter.commuterId as never,
    rating: 4,
  });

  const stored = await t.run(async (ctx) => await ctx.db.get(feedbackId));
  expect(stored?.operatorId).toBe(operator.operatorId);
  expect(stored?.operatorId).not.toBe(otherOperator.operatorId);
});
