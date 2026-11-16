/**
 * What moves the vehicle on the map: the simulation, or GPS.
 *
 * A demo trip (`rides.demoMode`) is driven along the road by the server once
 * it starts. Before that, and for the whole of a live trip, the pins follow
 * GPS. Both maps read the ride's own flag, never a local setting, so the
 * passenger and the driver always agree on which one it is.
 */
export interface TripMode {
  /** The ride was booked as a demo trip. */
  isDemoTrip: boolean;
  /** GPS moves the pins, and the phone sends its position. */
  isFollowingGps: boolean;
  /** A demo trip is under way: the simulation drives the vehicle. */
  isSimulating: boolean;
}

export function tripModeFor(
  ride: { demoMode?: boolean; status: string } | null | undefined
): TripMode {
  const isDemoTrip = ride?.demoMode === true;
  const status = ride?.status;
  return {
    isDemoTrip,
    isFollowingGps:
      status === "accepted" || (status === "inProgress" && !isDemoTrip),
    isSimulating: status === "inProgress" && isDemoTrip,
  };
}
