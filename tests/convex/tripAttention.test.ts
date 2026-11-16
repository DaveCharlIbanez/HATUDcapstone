import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createTest, seedAccount, seedRide, setCompletedAt } from "./helpers";

/**
 * The finished trip that still needs something from the passenger.
 *
 * The map, the payment page and the rating page all work on the same trip.
 * Without that agreement the passenger is shown one trip, pays another and
 * rates a third — and the map keeps offering to pay for a trip that was
 * settled long ago.
 */

async function setPaymentStatus(
  t: ReturnType<typeof createTest>,
  rideId: string,
  status: "unpaid" | "paid"
) {
  await t.run(async (ctx) => {
    await ctx.db.patch(rideId as never, {
      paymentStatus: status,
    });
  });
}

test("a paid trip that has not been rated still needs attention", async () => {
  const t = createTest();
  const passenger = await seedAccount(t, {
    email: "paid-unrated@example.com",
    name: "Paid Unrated",
    phone: "+639000000601",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "paid-unrated-driver@example.com",
    name: "Paid Unrated Driver",
    phone: "+639000000602",
    role: "operator",
  });

  const rideId = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });
  await setPaymentStatus(t, rideId, "paid");
  await setCompletedAt(t, rideId, Date.now());

  const active = await t.query(api.rides.getActiveForMe, {
    sessionToken: passenger.sessionToken,
  });

  // The trip is paid, but the driver has not been rated, so it is still the
  // trip the passenger has to deal with.
  expect(active?.latestCompleted?._id).toBe(rideId);
});

test("a trip that ended days ago is not what greets the passenger on the map", async () => {
  const t = createTest();
  const passenger = await seedAccount(t, {
    email: "old-trip@example.com",
    name: "Old Trip",
    phone: "+639000000612",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "old-trip-driver@example.com",
    name: "Old Trip Driver",
    phone: "+639000000613",
    role: "operator",
  });

  const rideId = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });
  await setPaymentStatus(t, rideId, "paid");
  // It ended two days ago.
  await setCompletedAt(t, rideId, Date.now() - 2 * 24 * 60 * 60 * 1000);

  const active = await t.query(api.rides.getActiveForMe, {
    sessionToken: passenger.sessionToken,
  });

  // The map goes back to being the booking screen.
  expect(active?.latestCompleted ?? null).toBeNull();

  // It is paid, and a rating is only asked for within a day of the trip, so
  // the dashboard does not keep asking either.
  const pending = await t.query(api.rides.getTripNeedingAttention, {
    sessionToken: passenger.sessionToken,
  });
  expect(pending).toBeNull();
});

test("a trip that is paid and rated needs nothing, and the map goes back to booking", async () => {
  const t = createTest();
  const passenger = await seedAccount(t, {
    email: "settled@example.com",
    name: "Settled",
    phone: "+639000000603",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "settled-driver@example.com",
    name: "Settled Driver",
    phone: "+639000000604",
    role: "operator",
  });

  const rideId = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });
  await setPaymentStatus(t, rideId, "paid");
  await t.mutation(api.feedback.create, {
    commuterId: passenger.commuterId,
    rating: 5,
    rideId,
    sessionToken: passenger.sessionToken,
  });

  const active = await t.query(api.rides.getActiveForMe, {
    sessionToken: passenger.sessionToken,
  });

  // Nothing is left to do, so the passenger sees the booking screen again.
  expect(active?.latestCompleted ?? null).toBeNull();
});

test("the trip that needs attention is the newest one that is not settled", async () => {
  const t = createTest();
  const passenger = await seedAccount(t, {
    email: "newest-first@example.com",
    name: "Newest First",
    phone: "+639000000605",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "newest-first-driver@example.com",
    name: "Newest First Driver",
    phone: "+639000000606",
    role: "operator",
  });

  // An older trip, settled.
  const settled = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });
  await setPaymentStatus(t, settled, "paid");
  await setCompletedAt(t, settled, Date.now());
  await t.mutation(api.feedback.create, {
    commuterId: passenger.commuterId,
    rating: 4,
    rideId: settled,
    sessionToken: passenger.sessionToken,
  });

  // A newer trip that still owes something.
  const owed = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });
  await setPaymentStatus(t, owed, "unpaid");
  await setCompletedAt(t, owed, Date.now());

  const active = await t.query(api.rides.getActiveForMe, {
    sessionToken: passenger.sessionToken,
  });

  // The settled older trip does not hide the one that still needs attention.
  expect(active?.latestCompleted?._id).toBe(owed);
});

test("the rating page offers a trip that has not been rated yet", async () => {
  const t = createTest();
  const passenger = await seedAccount(t, {
    email: "rate-next@example.com",
    name: "Rate Next",
    phone: "+639000000607",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "rate-next-driver@example.com",
    name: "Rate Next Driver",
    phone: "+639000000608",
    role: "operator",
  });

  const rated = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });
  await setPaymentStatus(t, rated, "paid");
  await t.mutation(api.feedback.create, {
    commuterId: passenger.commuterId,
    rating: 3,
    rideId: rated,
    sessionToken: passenger.sessionToken,
  });

  const unrated = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });
  await setPaymentStatus(t, unrated, "paid");
  await setCompletedAt(t, unrated, Date.now());

  const ride = await t.query(api.rides.getLatestCompletedForMe, {
    sessionToken: passenger.sessionToken,
  });

  expect(ride?._id).toBe(unrated);
});

test("the rating page can be sent to one particular trip", async () => {
  const t = createTest();
  const passenger = await seedAccount(t, {
    email: "targeted@example.com",
    name: "Targeted",
    phone: "+639000000609",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "targeted-driver@example.com",
    name: "Targeted Driver",
    phone: "+639000000610",
    role: "operator",
  });

  const first = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });
  const second = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });

  const ride = await t.query(api.rides.getLatestCompletedForMe, {
    rideId: first,
    sessionToken: passenger.sessionToken,
  });

  expect(ride?._id).toBe(first);
  expect(ride?._id).not.toBe(second);
});

test("a passenger cannot be sent to somebody else's trip", async () => {
  const t = createTest();
  const passenger = await seedAccount(t, {
    email: "not-mine-target@example.com",
    name: "Not Mine Target",
    phone: "+639000000611",
    role: "commuter",
  });
  const other = await seedAccount(t, {
    email: "other-target@example.com",
    name: "Other Target",
    phone: "+639000000612",
    role: "commuter",
  });

  const rideId = await seedRide(t, other.commuterId, { status: "completed" });

  await expect(
    t.query(api.rides.getLatestCompletedForMe, {
      rideId,
      sessionToken: passenger.sessionToken,
    })
  ).rejects.toThrow("does not belong to you");
});

async function seedFinishedTrip(
  t: ReturnType<typeof createTest>,
  key: string,
  phoneSuffix: number
) {
  const passenger = await seedAccount(t, {
    email: `${key}@example.com`,
    name: key,
    phone: `+6390000007${String(phoneSuffix).padStart(2, "0")}`,
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: `${key}-driver@example.com`,
    name: `${key} driver`,
    phone: `+6390000007${String(phoneSuffix + 1).padStart(2, "0")}`,
    role: "operator",
  });
  const rideId = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });
  await setPaymentStatus(t, rideId, "paid");
  await setCompletedAt(t, rideId, Date.now() - 60 * 60 * 1000);
  return { driver, passenger, rideId };
}

test("a trip that just ended asks for a rating on the dashboard", async () => {
  const t = createTest();
  const { passenger, rideId } = await seedFinishedTrip(t, "just-ended", 1);

  const pending = await t.query(api.rides.getTripNeedingAttention, {
    sessionToken: passenger.sessionToken,
  });
  expect(pending?.rideId).toBe(rideId);
  expect(pending?.needsPayment).toBe(false);
  expect(pending?.needsRating).toBe(true);
});

test("skipping the rating stops it being asked again", async () => {
  const t = createTest();
  const { passenger, rideId } = await seedFinishedTrip(t, "skipped", 3);

  await t.mutation(api.rides.dismissRatingPrompt, {
    rideId,
    sessionToken: passenger.sessionToken,
  });
  // Skipping twice is harmless.
  await t.mutation(api.rides.dismissRatingPrompt, {
    rideId,
    sessionToken: passenger.sessionToken,
  });

  const pending = await t.query(api.rides.getTripNeedingAttention, {
    sessionToken: passenger.sessionToken,
  });
  expect(pending).toBeNull();

  const toRate = await t.query(api.rides.getLatestCompletedForMe, {
    sessionToken: passenger.sessionToken,
  });
  expect(toRate).toBeNull();

  // The passenger can still rate it on purpose, from the receipt.
  await t.mutation(api.feedback.create, {
    commuterId: passenger.commuterId,
    rating: 5,
    rideId,
    sessionToken: passenger.sessionToken,
  });
});

test("rating the newest trip does not uncover an older unrated one", async () => {
  const t = createTest();
  const {
    driver,
    passenger,
    rideId: older,
  } = await seedFinishedTrip(t, "no-backlog", 5);

  const newest = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });
  await setPaymentStatus(t, newest, "paid");
  await setCompletedAt(t, newest, Date.now());
  await t.mutation(api.feedback.create, {
    commuterId: passenger.commuterId,
    rating: 4,
    rideId: newest,
    sessionToken: passenger.sessionToken,
  });

  const pending = await t.query(api.rides.getTripNeedingAttention, {
    sessionToken: passenger.sessionToken,
  });
  expect(pending).toBeNull();
  expect(older).not.toBe(newest);
});

test("an older unpaid trip is still asked for, whatever its age", async () => {
  const t = createTest();
  const {
    driver,
    passenger,
    rideId: older,
  } = await seedFinishedTrip(t, "old-unpaid", 7);
  await setPaymentStatus(t, older, "unpaid");
  await setCompletedAt(t, older, Date.now() - 5 * 24 * 60 * 60 * 1000);

  const newest = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });
  await setPaymentStatus(t, newest, "paid");
  await setCompletedAt(t, newest, Date.now());

  const pending = await t.query(api.rides.getTripNeedingAttention, {
    sessionToken: passenger.sessionToken,
  });
  expect(pending?.rideId).toBe(older);
  expect(pending?.needsPayment).toBe(true);
});

test("a passenger cannot skip the rating of somebody else's trip", async () => {
  const t = createTest();
  const { rideId } = await seedFinishedTrip(t, "skip-owner", 9);
  const stranger = await seedAccount(t, {
    email: "skip-stranger@example.com",
    name: "Skip Stranger",
    phone: "+639000000799",
    role: "commuter",
  });

  await expect(
    t.mutation(api.rides.dismissRatingPrompt, {
      rideId,
      sessionToken: stranger.sessionToken,
    })
  ).rejects.toThrow("does not belong to you");
});

test("a trip that is not finished cannot be skipped", async () => {
  const t = createTest();
  const passenger = await seedAccount(t, {
    email: "skip-live@example.com",
    name: "Skip Live",
    phone: "+639000000798",
    role: "commuter",
  });
  const rideId = await seedRide(t, passenger.commuterId, { status: "pending" });

  await expect(
    t.mutation(api.rides.dismissRatingPrompt, {
      rideId,
      sessionToken: passenger.sessionToken,
    })
  ).rejects.toThrow("completed");
});
