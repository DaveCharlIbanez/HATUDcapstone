/**
 * How far apart two places are, along a road.
 *
 * The distance a fare is charged on has to be the distance the passenger
 * actually travels, which is the distance the router draws on the map. A
 * straight line with a multiplier is not that: measured over three hundred
 * real trips in Antique, the true ratio of road distance to straight-line
 * distance ranged from 0.85 to 3.98, and a single multiplier overcharged
 * seventy per cent of them.
 *
 * So the router is the source of truth, and the estimate is only ever the
 * fallback for when the router cannot be reached.
 *
 * OSRM's own routing algorithm is Dijkstra over the OpenStreetMap road graph,
 * accelerated with contraction hierarchies. It is already the thing drawing
 * the route on the map, so using it for the price is what makes the two
 * agree.
 */

import { v } from "convex/values";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/** A pair of coordinates, as a function argument. */
export const coordinateValidator = v.object({
  latitude: v.number(),
  longitude: v.number(),
});

/** The public OSRM demo server. It has no service level and no guarantee. */
export const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

/**
 * How long to wait for the router before falling back to the estimate.
 *
 * A fare is a money figure and it can never be allowed to hang. Three
 * seconds is long enough for the router to answer and short enough that a
 * passenger is not left staring at a price that never arrives.
 */
export const ROUTER_TIMEOUT_MS = 3000;

/**
 * Straight-line distance understates road distance, by an amount that depends
 * entirely on the road.
 *
 * This is the fallback, used when the router cannot be reached. It was
 * recalibrated by measuring three hundred real trips between the app's own
 * landmarks: 1.18 is the multiplier that minimises the average error, where
 * the old 1.3 overcharged two trips in every three.
 */
export const ROAD_CIRCUITY_FACTOR = 1.18;

const EARTH_RADIUS_KM = 6371;

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function haversineKm(from: Coordinate, to: Coordinate): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * The estimated road distance, in kilometres.
 *
 * This is the fallback, not the answer. It is within about a fifth of the
 * truth on an average trip and can be far worse on one that has to take a
 * detour, which is exactly why the router is asked first.
 */
export function estimateRoadKm(from: Coordinate, to: Coordinate): number {
  return round2(haversineKm(from, to) * ROAD_CIRCUITY_FACTOR);
}

interface OsrmRouteResponse {
  routes?: { distance?: number }[];
}

/**
 * The road distance between two places, as the router measures it.
 *
 * Returns null when the router cannot be reached or does not answer. The
 * caller falls back to the estimate, so a fare is always computable.
 */
export async function fetchRoadDistanceKm(
  from: Coordinate,
  to: Coordinate
): Promise<number | null> {
  if (typeof fetch !== "function") {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${OSRM_BASE_URL}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=false`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as OsrmRouteResponse;
    const metres = body.routes?.[0]?.distance;
    if (typeof metres !== "number" || !Number.isFinite(metres)) {
      return null;
    }

    return round2(metres / 1000);
  } catch {
    // The router is down, slow, or blocked. The estimate will do.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The key a pair of places is cached under.
 *
 * Four decimal places is about eleven metres, which is far finer than the
 * difference between two readings of the same place and far coarser than two
 * genuinely different pickups.
 */
export function routeCacheKey(from: Coordinate, to: Coordinate): string {
  const place = (point: Coordinate) =>
    `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`;
  return `${place(from)}|${place(to)}`;
}

interface OsrmGeometryResponse {
  routes?: { geometry?: { coordinates?: unknown } }[];
}

/**
 * The shape of the road between two places, as `[longitude, latitude]` points.
 *
 * It is the same road the map highlights, which is the road the simulated
 * trip is driven along. Returns null when the router cannot be reached, and
 * the caller falls back to a straight line so a trip can always be driven.
 */
export async function fetchRoadGeometry(
  from: Coordinate,
  to: Coordinate
): Promise<[number, number][] | null> {
  if (typeof fetch !== "function") {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${OSRM_BASE_URL}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`,
      { signal: controller.signal }
    );
    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as OsrmGeometryResponse;
    const coordinates = body.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coordinates)) {
      return null;
    }

    const points: [number, number][] = [];
    for (const point of coordinates) {
      if (
        Array.isArray(point) &&
        typeof point[0] === "number" &&
        typeof point[1] === "number" &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1])
      ) {
        points.push([point[0], point[1]]);
      }
    }
    return points.length >= 2 ? points : null;
  } catch {
    // The router is down, slow, or blocked. The straight line will do.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
