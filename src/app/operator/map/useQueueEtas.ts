"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRouteDurations } from "@/lib/mapClient";

/**
 * How often the queue's times are measured again.
 *
 * A minute is often enough for a queue of a handful of requests, and it is
 * one request for the whole queue rather than one for each request in it.
 */
const REFRESH_INTERVAL_MS = 60_000;

/**
 * How far the driver has to move before the times are measured again.
 *
 * A hundred metres is a couple of minutes on a motorcycle, so anything
 * closer than that would not change what the numbers say — and the router is
 * a free public service.
 */
const MIN_ORIGIN_MOVE_M = 100;

export interface QueuePickup {
  id: string;
  latitude: number;
  longitude: number;
}

interface Point {
  latitude: number;
  longitude: number;
}

/**
 * How long the road takes from the driver to each open request.
 *
 * The router's table service answers a whole matrix of journeys in one
 * request, which is what makes it affordable to put a time on every request
 * in a driver's queue.
 *
 * The times are keyed by request id, and a request that has not been measured
 * yet is simply absent — so the queue shows a time as soon as there is one,
 * and never shows a made-up one.
 */
export function useQueueEtas({
  origin,
  pickups,
}: {
  origin: Point | null;
  pickups: QueuePickup[];
}): Map<string, number> {
  const [etas, setEtas] = useState<Map<string, number>>(new Map());

  // The latest fix, read when the times are measured rather than when the
  // effect last ran.
  const originRef = useRef(origin);
  useEffect(() => {
    originRef.current = origin;
  }, [origin]);

  // The latest list, read when the times are measured rather than when the
  // effect last ran.
  const pickupsRef = useRef(pickups);
  pickupsRef.current = pickups;

  const measuredFromRef = useRef<Point | null>(null);

  const measure = useCallback(async () => {
    const current = originRef.current;
    const list = pickupsRef.current;

    if (!(current && list.length > 0)) {
      setEtas(new Map());
      return;
    }

    const durations = await getRouteDurations(
      [current.longitude, current.latitude],
      list.map((pickup) => [pickup.longitude, pickup.latitude])
    );

    // The router answered with a different number of journeys than we asked
    // for, so the answers cannot be lined up with the requests.
    if (durations.length !== list.length) {
      return;
    }

    const measured = new Map<string, number>();
    list.forEach((pickup, index) => {
      const seconds = durations[index];
      if (seconds !== undefined && seconds > 0) {
        measured.set(pickup.id, seconds);
      }
    });

    setEtas(measured);
    measuredFromRef.current = current;
  }, []);

  // The requests are identified by their ids, so the queue is measured again
  // when the set of requests changes and not every time the server sends it.
  const measuredIdsRef = useRef<string | null>(null);

  useEffect(() => {
    const ids = pickups.map((pickup) => pickup.id).join(",");
    if (ids === measuredIdsRef.current) {
      return;
    }
    measuredIdsRef.current = ids;
    measure().catch(() => undefined);
  }, [measure, pickups]);

  // And again on a slow cadence, once the driver has moved far enough for the
  // numbers to have changed.
  useEffect(() => {
    const interval = setInterval(() => {
      const current = originRef.current;
      const last = measuredFromRef.current;

      // The router is not asked again until the driver has actually moved.
      if (
        current &&
        last &&
        distanceBetween(current, last) < MIN_ORIGIN_MOVE_M
      ) {
        return;
      }
      measure().catch(() => undefined);
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [measure]);

  return etas;
}

/**
 * The distance between two points, in metres.
 */
function distanceBetween(a: Point, b: Point): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
