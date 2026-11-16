import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createTest, seedAccount, seedRide } from "./helpers";

/**
 * Rating a driver.
 *
 * A passenger reads the driver's average rating before leaving one of their
 * own, so the lookup has to answer for a passenger — not only for the driver
 * and an admin. When it refused, the page died before the rating form could
 * be used at all.
 */

test("a passenger who rode with the driver can read their average rating", async () => {
  const t = createTest();
  const passenger = await seedAccount(t, {
    email: "rater@example.com",
    name: "Rater",
    phone: "+639000000501",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "rated@example.com",
    name: "Rated Driver",
    phone: "+639000000502",
    role: "operator",
  });

  const rideId = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });

  await t.mutation(api.feedback.create, {
    commuterId: passenger.commuterId,
    rating: 4,
    rideId,
    sessionToken: passenger.sessionToken,
  });

  const average = await t.query(api.feedback.getAverageForOperator, {
    operatorId: driver.operatorId,
    sessionToken: passenger.sessionToken,
  });

  expect(average.average).toBe(4);
  expect(average.count).toBe(1);
});

test("a driver can still read their own average", async () => {
  const t = createTest();
  const driver = await seedAccount(t, {
    email: "self@example.com",
    name: "Self Driver",
    phone: "+639000000503",
    role: "operator",
  });

  const average = await t.query(api.feedback.getAverageForOperator, {
    operatorId: driver.operatorId,
    sessionToken: driver.sessionToken,
  });

  expect(average.average).toBe(0);
  expect(average.count).toBe(0);
});

test("a passenger who has not ridden with the driver cannot read their rating", async () => {
  const t = createTest();
  const stranger = await seedAccount(t, {
    email: "stranger@example.com",
    name: "Stranger",
    phone: "+639000000504",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "unrelated@example.com",
    name: "Unrelated Driver",
    phone: "+639000000505",
    role: "operator",
  });

  await expect(
    t.query(api.feedback.getAverageForOperator, {
      operatorId: driver.operatorId,
      sessionToken: stranger.sessionToken,
    })
  ).rejects.toThrow("cannot see this driver's rating");
});

test("a passenger can read the feedback they left for a ride", async () => {
  const t = createTest();
  const passenger = await seedAccount(t, {
    email: "reader@example.com",
    name: "Reader",
    phone: "+639000000506",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "read-driver@example.com",
    name: "Read Driver",
    phone: "+639000000507",
    role: "operator",
  });

  const rideId = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });

  await t.mutation(api.feedback.create, {
    commuterId: passenger.commuterId,
    comment: "Great driver",
    rating: 5,
    rideId,
    sessionToken: passenger.sessionToken,
  });

  const feedback = await t.query(api.feedback.getForRide, {
    rideId,
    sessionToken: passenger.sessionToken,
  });

  expect(feedback?.rating).toBe(5);
  expect(feedback?.comment).toBe("Great driver");
});

test("a ride with no feedback yet reads as none", async () => {
  const t = createTest();
  const passenger = await seedAccount(t, {
    email: "unrated@example.com",
    name: "Unrated",
    phone: "+639000000508",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "unrated-driver@example.com",
    name: "Unrated Driver",
    phone: "+639000000509",
    role: "operator",
  });

  const rideId = await seedRide(t, passenger.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });

  const feedback = await t.query(api.feedback.getForRide, {
    rideId,
    sessionToken: passenger.sessionToken,
  });

  expect(feedback).toBeNull();
});

test("a passenger cannot read someone else's feedback", async () => {
  const t = createTest();
  const author = await seedAccount(t, {
    email: "author@example.com",
    name: "Author",
    phone: "+639000000510",
    role: "commuter",
  });
  const stranger = await seedAccount(t, {
    email: "nosy@example.com",
    name: "Nosy",
    phone: "+639000000511",
    role: "commuter",
  });
  const driver = await seedAccount(t, {
    email: "author-driver@example.com",
    name: "Author Driver",
    phone: "+639000000512",
    role: "operator",
  });

  const rideId = await seedRide(t, author.commuterId, {
    operatorId: driver.operatorId,
    status: "completed",
  });

  await t.mutation(api.feedback.create, {
    commuterId: author.commuterId,
    comment: "Mine",
    rating: 3,
    rideId,
    sessionToken: author.sessionToken,
  });

  await expect(
    t.query(api.feedback.getForRide, {
      rideId,
      sessionToken: stranger.sessionToken,
    })
  ).rejects.toThrow("cannot read this feedback");
});
