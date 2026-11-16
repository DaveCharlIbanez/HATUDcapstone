/**
 * Moving a vehicle along a road, for the simulated trip.
 *
 * Once a trip starts, the vehicle is driven along the highlighted route by
 * the server, not by the phones' GPS. The server moves it every few seconds
 * and both screens animate between those steps. The arithmetic lives here,
 * in the Convex tree, because the server and the two screens all have to
 * place the vehicle at exactly the same point for the same distance.
 */

import { distanceMeters } from "./arrival";

/** A point on the road, as `[longitude, latitude]` — the GeoJSON order. */
export type LngLat = [number, number];

/** How often the server moves the vehicle. */
export const SIM_TICK_MS = 3000;

/** The slowest and fastest the simulated vehicle drives. */
export const MIN_SPEED_KMH = 30;
export const MAX_SPEED_KMH = 50;

/** How much the speed may change from one step to the next. */
export const MAX_SPEED_STEP_KMH = 4;

/**
 * The most time a single step may account for.
 *
 * A step normally covers three seconds. If one runs late — the scheduler was
 * busy, or a stalled trip was restarted — it still only moves the vehicle
 * this far, so the vehicle never jumps down the road.
 */
export const MAX_TICK_ELAPSED_MS = 6000;

/** A trip that has not moved for this long is restarted by the watchdog. */
export const SIM_STALL_MS = 15_000;

/**
 * The most points a stored road keeps.
 *
 * Far below Convex's limit on an array, and far more than a road in town
 * needs to look right.
 */
export const MAX_ROUTE_POINTS = 2000;

/** A road, ready to be travelled along. */
export interface ProgressRoute {
  coordinates: LngLat[];
  /** How far along the road each point is, in metres. Starts at 0. */
  cumulativeMeters: number[];
  totalMeters: number;
}

/** The item at `index`, which the caller knows is there. */
function item<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) {
    throw new Error(`No point at ${index}`);
  }
  return value;
}

function metresBetween(a: LngLat, b: LngLat): number {
  return distanceMeters(
    { latitude: a[1], longitude: a[0] },
    { latitude: b[1], longitude: b[0] }
  );
}

/**
 * Keeps every k-th point and always the last, so a long road fits.
 */
function thin(coordinates: LngLat[], limit: number): LngLat[] {
  if (coordinates.length <= limit) {
    return coordinates;
  }
  const step = Math.ceil(coordinates.length / (limit - 1));
  const kept: LngLat[] = [];
  for (let index = 0; index < coordinates.length - 1; index += step) {
    kept.push(item(coordinates, index));
  }
  kept.push(coordinates.at(-1) as LngLat);
  return kept;
}

/**
 * Turns a line of points into a road that can be travelled along.
 *
 * Repeated points are dropped, because a step of zero length has no
 * direction to travel in.
 */
export function buildRoute(points: LngLat[]): ProgressRoute {
  const distinct: LngLat[] = [];
  for (const point of points) {
    const last = distinct.at(-1);
    if (!last || last[0] !== point[0] || last[1] !== point[1]) {
      distinct.push(point);
    }
  }
  const coordinates = thin(distinct, MAX_ROUTE_POINTS);

  const cumulativeMeters: number[] = [];
  let total = 0;
  for (let index = 0; index < coordinates.length; index++) {
    if (index > 0) {
      total += metresBetween(
        item(coordinates, index - 1),
        item(coordinates, index)
      );
    }
    cumulativeMeters.push(total);
  }

  return { coordinates, cumulativeMeters, totalMeters: total };
}

/**
 * The index of the stretch of road that `meters` falls on.
 *
 * Binary search: the road can be two thousand points long and this runs on
 * every animation frame.
 */
function segmentIndex(route: ProgressRoute, meters: number): number {
  const { cumulativeMeters } = route;
  let low = 0;
  let high = cumulativeMeters.length - 1;
  while (low < high - 1) {
    const middle = Math.floor((low + high) / 2);
    if (item(cumulativeMeters, middle) <= meters) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return low;
}

/**
 * The point `meters` along the road.
 *
 * Anything before the start is the start, and anything past the end is the
 * end.
 */
export function pointAlong(route: ProgressRoute, meters: number): LngLat {
  const { coordinates, cumulativeMeters, totalMeters } = route;
  if (coordinates.length === 0) {
    throw new Error("A road needs at least one point");
  }
  if (coordinates.length === 1 || meters <= 0) {
    return item(coordinates, 0);
  }
  if (meters >= totalMeters) {
    return coordinates.at(-1) as LngLat;
  }

  const index = segmentIndex(route, meters);
  const start = item(coordinates, index);
  const end = item(coordinates, index + 1);
  const startMeters = item(cumulativeMeters, index);
  const length = item(cumulativeMeters, index + 1) - startMeters;
  const fraction = length > 0 ? (meters - startMeters) / length : 0;

  return [
    start[0] + (end[0] - start[0]) * fraction,
    start[1] + (end[1] - start[1]) * fraction,
  ];
}

/**
 * The part of the road still to be driven, from `meters` to the end.
 *
 * This is what the highlighted route shows during the trip: it shrinks
 * behind the vehicle.
 */
export function remainingLine(route: ProgressRoute, meters: number): LngLat[] {
  const { coordinates, totalMeters } = route;
  if (coordinates.length < 2 || meters >= totalMeters) {
    return [];
  }
  if (meters <= 0) {
    return coordinates;
  }
  const index = segmentIndex(route, meters);
  return [pointAlong(route, meters), ...coordinates.slice(index + 1)];
}

/** Keeps a speed between the slowest and the fastest. */
export function clampSpeed(kmh: number): number {
  return Math.min(MAX_SPEED_KMH, Math.max(MIN_SPEED_KMH, kmh));
}

/**
 * The speed the vehicle sets off at.
 *
 * `random` is a number in [0, 1), passed in so tests can choose it.
 */
export function initialSpeed(random: number): number {
  return clampSpeed(MIN_SPEED_KMH + (MAX_SPEED_KMH - MIN_SPEED_KMH) * random);
}

/**
 * The speed for the next step: a little faster or slower than the last.
 *
 * A random walk rather than a fresh random speed each time, so the vehicle
 * speeds up and slows down the way traffic does instead of lurching.
 */
export function nextSpeed(previousKmh: number, random: number): number {
  const change = (random * 2 - 1) * MAX_SPEED_STEP_KMH;
  return clampSpeed(previousKmh + change);
}

/** How far a vehicle travels at `kmh` in `elapsedMs`, in metres. */
export function metersTravelled(kmh: number, elapsedMs: number): number {
  return (kmh / 3.6) * (elapsedMs / 1000);
}

/** How long the rest of the road takes at the current speed, in seconds. */
export function secondsRemaining(remainingMeters: number, kmh: number): number {
  if (remainingMeters <= 0) {
    return 0;
  }
  return Math.round(remainingMeters / (kmh / 3.6));
}
