/**
 * Fares are computed on the server and locked in when the ride is created.
 *
 * The tariff is a flat base fee that covers the first few kilometres, plus a
 * metered increment for every started kilometre beyond that.
 */

export type VehicleType = "standard" | "priority";

export interface FareRate {
  /** Flat fee charged for every ride. */
  base: number;
  /** Distance covered by the base fee, in kilometres. */
  includedKm: number;
  /** Charged for every started kilometre beyond `includedKm`. */
  perKm: number;
}

export const FARE_RATES: Record<VehicleType, FareRate> = {
  standard: { base: 30, includedKm: 2, perKm: 10 },
  priority: { base: 50, includedKm: 2, perKm: 12 },
};

/**
 * Straight-line distance understates road distance by roughly a quarter in
 * dense urban areas; this factor converts one to the other.
 */
export const ROAD_CIRCUITY_FACTOR = 1.3;

const EARTH_RADIUS_KM = 6371;

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface FareQuote {
  baseFare: number;
  /** Effective road distance in kilometres. */
  distanceKm: number;
  /** Total amount charged. */
  fare: number;
  includedKm: number;
  meteredAmount: number;
  /** Kilometres billed beyond the included distance. */
  meteredKm: number;
}

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

export function roadDistanceKm(from: Coordinate, to: Coordinate): number {
  return round2(haversineKm(from, to) * ROAD_CIRCUITY_FACTOR);
}

export function quoteFare(
  vehicleType: VehicleType,
  distanceKm: number
): FareQuote {
  const rate = FARE_RATES[vehicleType];
  const billableKm = Math.max(0, round2(distanceKm - rate.includedKm));
  const meteredKm = Math.ceil(billableKm);
  const meteredAmount = meteredKm * rate.perKm;

  return {
    fare: rate.base + meteredAmount,
    baseFare: rate.base,
    includedKm: rate.includedKm,
    meteredKm,
    meteredAmount,
    distanceKm: round2(distanceKm),
  };
}

export function quoteForTrip(
  vehicleType: VehicleType,
  pickup: Coordinate,
  dropoff: Coordinate
): FareQuote {
  return quoteFare(vehicleType, roadDistanceKm(pickup, dropoff));
}
