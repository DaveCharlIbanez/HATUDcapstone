import { expect, test } from "vitest";
import {
  BACK_LABELS,
  backTargetFor,
  stageForRide,
} from "../src/app/map/rideStage";

/**
 * The passenger's screen, and the state of their ride.
 *
 * The rule used to live inside a `useEffect` where no test could reach it.
 * That is how a bug survived long enough to be reported from a phone: the
 * server finished a ride, the client was told there was no ride, and the
 * screen stayed frozen on "Ride in progress" because nothing had any way to
 * notice.
 *
 * Every assertion here is a way the screen could get the stage wrong.
 */

test("a request that nobody has taken is still being searched for", () => {
  expect(stageForRide({ status: "pending" })).toEqual({
    status: "searching",
    step: "booking",
  });
});

test("a ride with a driver waits for the passenger to confirm it", () => {
  expect(stageForRide({ status: "accepted" })).toEqual({
    status: "matched",
    step: "tracking",
  });
});

test("a confirmed ride is under way", () => {
  expect(stageForRide({ status: "inProgress" })).toEqual({
    status: "in-progress",
    step: "tracking",
  });
});

test("a finished ride says so — and never says it is still in progress", () => {
  const stage = stageForRide({ status: "completed" });

  expect(stage).toEqual({ status: "completed", step: "tracking" });
  expect(stage?.status).not.toBe("in-progress");
});

test("a cancelled ride has no stage, so the booking is cleared", () => {
  expect(stageForRide({ status: "cancelled" })).toBeNull();
});

test("a status the app does not know has no stage either", () => {
  expect(stageForRide({ status: "teleported" })).toBeNull();
});

test("there is no arriving stage — the trip starts with the confirmation", () => {
  // The "arriving" and "arrived" stages used to sit between the passenger's
  // confirmation and the driver's own "picked up" tap. The trip now starts
  // with the passenger's confirmation, so there is nothing between the two.
  const stage = stageForRide({ status: "accepted" });
  expect(stage?.status).not.toBe("arriving");
  expect(stage?.status).not.toBe("arrived");
});

test("every step before the ride is created can be left", () => {
  // The booking sheet is a sequence of steps, and until the ride exists
  // every one of them can be left. There was no way to do that before: the
  // sheet could only be dismissed, and dismissing threw the booking away.
  expect(backTargetFor("payment")).toBe("location");
});

test("the first step and a live ride have nowhere to go back to", () => {
  expect(backTargetFor("location")).toBeNull();
  // A ride that has been booked is not a step — it is a trip somebody is on.
  expect(backTargetFor("booking")).toBeNull();
  expect(backTargetFor("tracking")).toBeNull();
});

test("the back button says where it goes", () => {
  expect(BACK_LABELS.location).toBe("Back to pickup and destination");
});
