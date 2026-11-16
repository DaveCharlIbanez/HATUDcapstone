/**
 * Fares are computed on the server and locked in when the ride is created.
 *
 * The tariff is a flat base fee that covers the first few kilometres, plus a
 * metered increment for every started kilometre beyond that.
 *
 * There is one ride type. The tariff has one entry, because a second one
 * would be a choice the app does not offer.
 */

import { v } from "convex/values";
import { round2 } from "./routing";

export type VehicleType = "standard";

/** The ride type a ride is booked as. */
export const VEHICLE_TYPE: VehicleType = "standard";

/**
 * The ride types a client may ask for.
 *
 * "priority" is what the Android builds that predate the single ride type
 * send. There is no Priority ride any more: it is the ride that exists, at
 * the fare the rider was quoted — which is the same fare, because there is
 * only one. The value is accepted so those builds keep working.
 */
export const vehicleTypeValidator = v.union(
  v.literal("standard"),
  v.literal("priority")
);

/**
 * The ride type a booking is for.
 *
 * Whatever was asked for, a ride is booked as the one ride type there is.
 */
export function vehicleTypeFor(_requested: string | undefined): VehicleType {
  return VEHICLE_TYPE;
}

export interface FareRate {
  /** Flat fee charged for every ride. */
  base: number;
  /** Distance covered by the base fee, in kilometres. */
  includedKm: number;
  /** Charged for every started kilometre beyond `includedKm`. */
  perKm: number;
}

export const FARE_RATES: Record<VehicleType, FareRate> = {
  standard: { base: 30, includedKm: 2, perKm: 12 },
};

export const fareQuoteValidator = v.object({
  baseFare: v.number(),
  distanceKm: v.number(),
  fare: v.number(),
  includedKm: v.number(),
  meteredAmount: v.number(),
  meteredKm: v.number(),
});

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
