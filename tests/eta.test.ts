import { expect, test } from "vitest";
import { formatDistance, formatEta } from "../src/lib/format";

/**
 * The time the road takes, and how it is said.
 *
 * The router measures the road as it draws it, so the duration comes back
 * with the geometry. The public router has no live traffic, so the number is
 * the time the road takes at its own speed profile and not a promise about
 * the traffic on it — which is why it is always "about".
 */

test("a short road is about a minute", () => {
  expect(formatEta(45)).toBe("less than a minute");
  expect(formatEta(59)).toBe("less than a minute");
});

test("a road of a few minutes is about that many minutes", () => {
  expect(formatEta(60)).toBe("about 1 min");
  expect(formatEta(240)).toBe("about 4 min");
  expect(formatEta(1013)).toBe("about 17 min");
});

test("a long road is about an hour", () => {
  expect(formatEta(3600)).toBe("about 1 h");
  expect(formatEta(3900)).toBe("about 1 h 5 min");
  expect(formatEta(7200)).toBe("about 2 h");
});

test("a road that has not been measured says nothing", () => {
  // The panel shows no time rather than a made-up one.
  expect(formatEta(null)).toBe("");
  expect(formatEta(undefined)).toBe("");
  expect(formatEta(0)).toBe("");
});

test("a distance below a kilometre is in metres", () => {
  // "140 m" is more use to somebody looking for a house than "0.14 km".
  expect(formatDistance(140)).toBe("140 m");
  expect(formatDistance(999)).toBe("999 m");
});

test("a distance of a kilometre or more is in kilometres", () => {
  expect(formatDistance(1000)).toBe("1.0 km");
  expect(formatDistance(18_083)).toBe("18.1 km");
});

test("a distance that has not been measured says nothing", () => {
  expect(formatDistance(null)).toBe("");
  expect(formatDistance(undefined)).toBe("");
  expect(formatDistance(0)).toBe("");
});
