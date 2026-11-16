import { describe, expect, test } from "vitest";
import {
  buildRoute,
  initialSpeed,
  MAX_ROUTE_POINTS,
  MAX_SPEED_KMH,
  MAX_SPEED_STEP_KMH,
  MIN_SPEED_KMH,
  metersTravelled,
  nextSpeed,
  pointAlong,
  remainingLine,
  secondsRemaining,
} from "../convex/lib/routeProgress";

// Three points heading north, about 111 m apart.
const ROAD: [number, number][] = [
  [122, 10],
  [122, 10.001],
  [122, 10.002],
];

describe("buildRoute", () => {
  test("measures the road", () => {
    const route = buildRoute(ROAD);
    expect(route.cumulativeMeters[0]).toBe(0);
    expect(route.totalMeters).toBeGreaterThan(220);
    expect(route.totalMeters).toBeLessThan(225);
  });

  test("drops repeated points", () => {
    const route = buildRoute([ROAD[0], ROAD[0], ROAD[1]] as [number, number][]);
    expect(route.coordinates).toHaveLength(2);
  });

  test("thins a very long road but keeps both ends", () => {
    const long: [number, number][] = Array.from({ length: 9000 }, (_, i) => [
      122,
      10 + i * 0.000_01,
    ]);
    const route = buildRoute(long);
    expect(route.coordinates.length).toBeLessThanOrEqual(MAX_ROUTE_POINTS);
    expect(route.coordinates[0]).toEqual(long[0]);
    expect(route.coordinates.at(-1)).toEqual(long.at(-1));
  });
});

describe("pointAlong", () => {
  const route = buildRoute(ROAD);

  test("is the start before the road and the end after it", () => {
    expect(pointAlong(route, -5)).toEqual(ROAD[0]);
    expect(pointAlong(route, route.totalMeters + 5)).toEqual(ROAD[2]);
  });

  test("follows the road between its points", () => {
    const halfway = pointAlong(route, route.totalMeters / 2);
    expect(halfway[0]).toBeCloseTo(122);
    expect(halfway[1]).toBeCloseTo(10.001, 5);
  });
});

describe("remainingLine", () => {
  const route = buildRoute(ROAD);

  test("starts where the vehicle is and runs to the end", () => {
    const line = remainingLine(route, route.totalMeters * 0.25);
    expect(line[0]?.[1]).toBeCloseTo(10.0005, 5);
    expect(line.at(-1)).toEqual(ROAD[2]);
  });

  test("is empty once the road has been driven", () => {
    expect(remainingLine(route, route.totalMeters)).toEqual([]);
  });
});

describe("speed", () => {
  test("always stays between 30 and 50 km/h", () => {
    for (const random of [0, 0.25, 0.5, 0.75, 0.999]) {
      const start = initialSpeed(random);
      expect(start).toBeGreaterThanOrEqual(MIN_SPEED_KMH);
      expect(start).toBeLessThanOrEqual(MAX_SPEED_KMH);
      for (const previous of [MIN_SPEED_KMH, 40, MAX_SPEED_KMH]) {
        const next = nextSpeed(previous, random);
        expect(next).toBeGreaterThanOrEqual(MIN_SPEED_KMH);
        expect(next).toBeLessThanOrEqual(MAX_SPEED_KMH);
        expect(Math.abs(next - previous)).toBeLessThanOrEqual(
          MAX_SPEED_STEP_KMH
        );
      }
    }
  });

  test("covers 25 to 42 metres in a three-second step", () => {
    expect(metersTravelled(30, 3000)).toBeCloseTo(25, 0);
    expect(metersTravelled(50, 3000)).toBeCloseTo(41.7, 1);
  });

  test("gives the time left at the current speed", () => {
    expect(secondsRemaining(1000, 36)).toBe(100);
    expect(secondsRemaining(0, 36)).toBe(0);
  });
});
