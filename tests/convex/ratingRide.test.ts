import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createTest, seedAccount, seedRide } from "./helpers";

const NOT_YOURS = /does not belong/;

/**
 * The bug: after paying for a trip, the payment page's query moved on to the
 * next unpaid trip, and "Rate your driver" sent the passenger to rate that
 * older ride — showing its old rating, and saving new ratings against it.
 */
test("the payment page stays on the ride it was opened for after paying", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "pin-rider@example.com",
    name: "Pin Rider",
    phone: "+639000000801",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "pin-driver@example.com",
    name: "Pin Driver",
    phone: "+639000000802",
    role: "operator",
  });

  // An older trip that is still unpaid, and the trip just taken.
  const olderRide = await seedRide(t, commuter.commuterId, {
    completedAt: Date.now() - 60_000,
    operatorId: operator.operatorId,
    status: "completed",
  });
  const newRide = await seedRide(t, commuter.commuterId, {
    completedAt: Date.now(),
    operatorId: operator.operatorId,
    status: "completed",
  });

  await t.action(api.payments.charge, {
    sessionToken: commuter.sessionToken,
    rideId: newRide,
  });

  // Unpinned, the query has moved on to the older trip...
  const unpinned = await t.query(api.payments.getDue, {
    sessionToken: commuter.sessionToken,
  });
  expect(unpinned?.rideId).toBe(olderRide);

  // ...but pinned, it is still the trip that was just paid, so the rating
  // button leads to the right ride.
  const pinned = await t.query(api.payments.getDue, {
    sessionToken: commuter.sessionToken,
    rideId: newRide,
  });
  expect(pinned?.rideId).toBe(newRide);
  expect(pinned?.paymentStatus).toBe("paid");
});

test("each ride is rated on its own", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "fresh-rider@example.com",
    name: "Fresh Rider",
    phone: "+639000000803",
    role: "commuter",
  });
  const operator = await seedAccount(t, {
    email: "fresh-driver@example.com",
    name: "Fresh Driver",
    phone: "+639000000804",
    role: "operator",
  });

  const firstRide = await seedRide(t, commuter.commuterId, {
    completedAt: Date.now() - 60_000,
    operatorId: operator.operatorId,
    status: "completed",
  });
  await t.mutation(api.feedback.create, {
    sessionToken: commuter.sessionToken,
    rideId: firstRide,
    commuterId: commuter.commuterId,
    rating: 2,
  });

  const secondRide = await seedRide(t, commuter.commuterId, {
    completedAt: Date.now(),
    operatorId: operator.operatorId,
    status: "completed",
  });

  // The new ride has no rating yet, and is the one offered for rating.
  expect(
    await t.query(api.feedback.getForRide, {
      sessionToken: commuter.sessionToken,
      rideId: secondRide,
    })
  ).toBeNull();
  const toRate = await t.query(api.rides.getLatestCompletedForMe, {
    sessionToken: commuter.sessionToken,
  });
  expect(toRate?._id).toBe(secondRide);
});

test("a passenger cannot pin someone else's ride on the payment page", async () => {
  const t = createTest();
  const owner = await seedAccount(t, {
    email: "owner-rider@example.com",
    name: "Owner",
    phone: "+639000000805",
    role: "commuter",
  });
  const other = await seedAccount(t, {
    email: "other-rider@example.com",
    name: "Other",
    phone: "+639000000806",
    role: "commuter",
  });
  const rideId = await seedRide(t, owner.commuterId, { status: "completed" });

  await expect(
    t.query(api.payments.getDue, { sessionToken: other.sessionToken, rideId })
  ).rejects.toThrow(NOT_YOURS);
});
