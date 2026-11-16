/**
 * Whether the driver has reached the passenger.
 *
 * The rule lives here, in the Convex tree, because both sides have to agree
 * on it: the server refuses a confirmation that arrives while the driver is
 * demonstrably still on the way, and the passenger's screen disables the
 * button for exactly the same reason. Two copies of this rule would drift,
 * and the passenger would be told one thing while the server did another.
 */

export interface Point {
  latitude: number;
  longitude: number;
}

/** The mean radius of the earth, in metres. */
const EARTH_RADIUS_M = 6_371_000;

/**
 * The distance between two points, in metres.
 *
 * Used on the passenger's map to tell whether the driver has reached the
 * pickup point, and on the server to refuse a confirmation that came too
 * early.
 */
export function distanceMeters(a: Point, b: Point): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * How close the driver has to be to the pickup point to count as arrived.
 *
 * A hundred metres is roughly the length of a street block, which is as close
 * as a GPS fix on a phone can honestly claim.
 */
export const DRIVER_ARRIVED_METERS = 100;

/**
 * How long a reported driver position is trusted.
 *
 * The driver pushes their position every five seconds while they are on a
 * job. A fix older than this says nothing about where they are now — the
 * phone was in a pocket, or the app was closed — so it is not used to refuse
 * a passenger their ride.
 */
export const OPERATOR_LOCATION_FRESH_MS = 120_000;

/** The parts of a ride the arrival rule needs. */
export interface ArrivalView {
  /** Where the driver last said they were, and when. */
  operatorLocation?: {
    latitude: number;
    longitude: number;
    updatedAt: number;
  } | null;
  /** Where the passenger is waiting. */
  pickup: Point;
}

/**
 * Whether the driver is still on the way.
 *
 * It is only true when there is fresh evidence that they are: a position
 * that has just been reported and is more than a street block from the
 * pickup. A driver who has reported nothing, or reported it long ago, is not
 * judged — a missing fix must never lock a passenger out of a trip.
 */
export function driverIsStillOnTheWay(
  ride: ArrivalView,
  now: number = Date.now()
): boolean {
  const location = ride.operatorLocation;
  if (!location) {
    return false;
  }
  if (now - location.updatedAt > OPERATOR_LOCATION_FRESH_MS) {
    return false;
  }
  return distanceMeters(location, ride.pickup) > DRIVER_ARRIVED_METERS;
}

/**
 * Whether the driver's last known position says they have arrived.
 *
 * The mirror of `driverIsStillOnTheWay`: true when the position is fresh and
 * close. It is what the passenger's screen says to them.
 */
export function driverHasArrived(
  ride: ArrivalView,
  now: number = Date.now()
): boolean {
  const location = ride.operatorLocation;
  if (!location) {
    return false;
  }
  if (now - location.updatedAt > OPERATOR_LOCATION_FRESH_MS) {
    return false;
  }
  return distanceMeters(location, ride.pickup) <= DRIVER_ARRIVED_METERS;
}
