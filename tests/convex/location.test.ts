import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createTest, seedAccount, seedRide } from "./helpers";

const PICKUP = { latitude: 10.5944, longitude: 121.9494 };
const DROPOFF = { latitude: 10.5923, longitude: 121.9476 };

test("a passenger and their driver can each read the other's live position", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "share-rider@example.com",
    name: "Share Rider",
    phone: "+639000000301",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "share-driver@example.com",
    name: "Share Driver",
    phone: "+639000000302",
    role: "operator",
  });

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  // The passenger pushes their position.
  await t.mutation(api.rides.updateCommuterLocation, {
    sessionToken: commuter.sessionToken,
    rideId,
    latitude: PICKUP.latitude,
    longitude: PICKUP.longitude,
  });

  // The driver pushes theirs.
  await t.mutation(api.rides.updateOperatorLocation, {
    sessionToken: operator.sessionToken,
    rideId,
    latitude: DROPOFF.latitude,
    longitude: DROPOFF.longitude,
  });

  const driverView = await t.query(api.rides.getPartnerLocation, {
    sessionToken: operator.sessionToken,
    rideId,
  });
  expect(driverView?.commuterLocation?.latitude).toBe(PICKUP.latitude);
  expect(driverView?.commuterLocation?.longitude).toBe(PICKUP.longitude);

  const riderView = await t.query(api.rides.getPartnerLocation, {
    sessionToken: commuter.sessionToken,
    rideId,
  });
  expect(riderView?.operatorLocation?.latitude).toBe(DROPOFF.latitude);
  expect(riderView?.operatorLocation?.longitude).toBe(DROPOFF.longitude);
});

test("a position carries the time it was recorded", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "stamped-rider@example.com",
    name: "Stamped Rider",
    phone: "+639000000303",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "stamped-driver@example.com",
    name: "Stamped Driver",
    phone: "+639000000304",
    role: "operator",
  });

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: operator.operatorId,
    status: "accepted",
  });

  const before = Date.now();
  await t.mutation(api.rides.updateCommuterLocation, {
    sessionToken: commuter.sessionToken,
    rideId,
    latitude: PICKUP.latitude,
    longitude: PICKUP.longitude,
  });

  const view = await t.query(api.rides.getPartnerLocation, {
    sessionToken: operator.sessionToken,
    rideId,
  });
  expect(view?.commuterLocation?.updatedAt).toBeGreaterThanOrEqual(before);
});

test("a driver cannot push a position for a ride they are not assigned to", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "unassigned-rider@example.com",
    name: "Unassigned Rider",
    phone: "+639000000305",
    role: "commuter",
  });
  const assigned = await seedAccount(t, {
    email: "assigned-driver@example.com",
    name: "Assigned Driver",
    phone: "+639000000306",
    role: "operator",
  });
  const stranger = await seedAccount(t, {
    email: "stranger-driver@example.com",
    name: "Stranger Driver",
    phone: "+639000000307",
    role: "operator",
  });

  const rideId = await seedRide(t, commuter.commuterId, {
    operatorId: assigned.operatorId,
    status: "accepted",
  });

  await expect(
    t.mutation(api.rides.updateOperatorLocation, {
      sessionToken: stranger.sessionToken,
      rideId,
      latitude: DROPOFF.latitude,
      longitude: DROPOFF.longitude,
    })
  ).rejects.toThrow("Forbidden");
});

test("a passenger cannot push a position for a ride that is not theirs", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "other-rider@example.com",
    name: "Other Rider",
    phone: "+639000000308",
    role: "commuter",
  });
  const stranger = await seedAccount(t, {
    email: "stranger-rider@example.com",
    name: "Stranger Rider",
    phone: "+639000000309",
    role: "commuter",
  });

  const rideId = await seedRide(t, commuter.commuterId, { status: "accepted" });

  await expect(
    t.mutation(api.rides.updateCommuterLocation, {
      sessionToken: stranger.sessionToken,
      rideId,
      latitude: PICKUP.latitude,
      longitude: PICKUP.longitude,
    })
  ).rejects.toThrow("Forbidden");
});
