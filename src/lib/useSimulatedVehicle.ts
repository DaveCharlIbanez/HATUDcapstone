"use client";

import { useQuery } from "convex/react";
import type maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearRouteLine, drawHighlightedRoute } from "@/lib/mapRoute";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  type LngLat,
  type ProgressRoute,
  pointAlong,
  remainingLine,
  SIM_TICK_MS,
  secondsRemaining,
} from "../../convex/lib/routeProgress";

/** How often the shrinking road is redrawn while the vehicle moves. */
const LINE_REDRAW_MS = 250;

/**
 * How far the two pins sit either side of the vehicle, in pixels, so the
 * driver and the passenger riding in it are both visible (fixoct52). The
 * first marker (the driver) goes left, the second (the passenger) right.
 */
const RIDER_OFFSET_PX = 14;

/** How much of the way to the vehicle the camera closes each frame when it
 * catches up after a re-centre. */
const CATCH_UP_FRACTION = 0.18;

/** Close enough, in pixels, for the camera to lock on to the vehicle. */
const LOCK_ON_PX = 1;

interface UseSimulatedVehicleOptions {
  /** Keep the camera on the vehicle until the person drags the map. */
  follow: boolean;
  /** The markers that ride in the vehicle. Read on every frame. */
  getMarkers: () => (maplibregl.Marker | null)[];
  map: maplibregl.Map | null;
  /** The started trip, or null when there is no trip under way. */
  rideId: Id<"rides"> | null;
  sessionToken: string | null;
}

export interface SimulatedVehicle {
  /** How long the rest of the road takes at the current speed. */
  etaSeconds: number | null;
  /** The vehicle is at the destination, so the ride can be ended. */
  hasArrived: boolean;
  /** The camera is following the vehicle. Off once the person moves the map. */
  isFollowing: boolean;
  /** The trip is being driven by the simulation. */
  isSimulating: boolean;
  /** Puts the camera back on the vehicle and follows it again. */
  recenter: () => void;
  /** How much road is left, in metres. */
  remainingMeters: number | null;
}

/**
 * Moves the pins riding in the vehicle to where it is. They sit either side
 * of it, so neither covers the other: the first (the driver) to the left, the
 * second (the passenger) to the right.
 */
function placeRiders(
  markers: (maplibregl.Marker | null)[],
  point: LngLat,
  offsetMarkers: Set<maplibregl.Marker>
): void {
  for (const [index, marker] of markers.entries()) {
    if (!marker) {
      continue;
    }
    if (!offsetMarkers.has(marker)) {
      marker.setOffset([index === 0 ? -RIDER_OFFSET_PX : RIDER_OFFSET_PX, 0]);
      offsetMarkers.add(marker);
    }
    marker.setLngLat(point);
  }
}

/** Redraws the road still to drive, or clears it once there is none. */
function drawRemainingRoad(map: maplibregl.Map, line: LngLat[]): void {
  try {
    if (line.length >= 2) {
      drawHighlightedRoute(
        map,
        { coordinates: line, type: "LineString" },
        "toDestination"
      );
    } else {
      clearRouteLine(map);
    }
  } catch {
    // The style is being swapped for a theme change. The next frame puts the
    // road back.
  }
}

/**
 * Keeps the camera on the vehicle. After a re-centre it glides there over a
 * few frames, then locks on.
 */
function followCamera(
  map: maplibregl.Map,
  point: LngLat,
  catchingUpRef: { current: boolean }
): void {
  if (!catchingUpRef.current) {
    map.setCenter(point);
    return;
  }
  const center = map.getCenter();
  const from = map.project(center);
  const to = map.project(point);
  if (Math.hypot(to.x - from.x, to.y - from.y) <= LOCK_ON_PX) {
    catchingUpRef.current = false;
    map.setCenter(point);
    return;
  }
  map.setCenter([
    center.lng + (point[0] - center.lng) * CATCH_UP_FRACTION,
    center.lat + (point[1] - center.lat) * CATCH_UP_FRACTION,
  ]);
}

/**
 * Shows the simulated vehicle driving the road.
 *
 * The server moves the vehicle every three seconds. Drawing only those
 * positions would make it hop, so between them it is animated along the road
 * itself — round the bends, not across them — arriving at each new position
 * as the next one comes in. It runs one step behind the server, which is
 * what lets it always have somewhere to go.
 *
 * The highlighted road shrinks behind the vehicle as it goes.
 */
export function useSimulatedVehicle({
  follow,
  getMarkers,
  map,
  rideId,
  sessionToken,
}: UseSimulatedVehicleOptions): SimulatedVehicle {
  const args = sessionToken && rideId ? { sessionToken, rideId } : "skip";
  const simulation = useQuery(api.rideSimulation.getForRide, args);
  const stored = useQuery(
    api.rideSimulation.getRoute,
    simulation?.ready ? args : "skip"
  );

  const route = useMemo<ProgressRoute | null>(() => {
    if (!stored) {
      return null;
    }
    return {
      coordinates: stored.coordinates.map(
        (point) => [point[0] ?? 0, point[1] ?? 0] as LngLat
      ),
      cumulativeMeters: stored.cumulativeMeters,
      totalMeters: stored.totalMeters,
    };
  }, [stored]);

  // The animation: from where the vehicle is drawn now, to the latest
  // position, over one step.
  const motionRef = useRef({ from: 0, startedAt: 0, to: 0 });
  const followRef = useRef(follow);
  followRef.current = follow;
  const shownRef = useRef(0);

  const target = simulation?.arrivedAt
    ? (route?.totalMeters ?? 0)
    : (simulation?.traveledMeters ?? 0);

  useEffect(() => {
    motionRef.current = {
      from: shownRef.current,
      startedAt: performance.now(),
      to: target,
    };
  }, [target]);

  // The camera follows until the person takes the map into their own hands.
  //
  // Touching the map is what stops it, not `dragstart` (fixoct52). The
  // camera is moved on every frame, and each move stops the gesture handlers,
  // so a pan was cancelled before it got far enough to count as a drag: the
  // map could be zoomed but never moved.
  const [isFollowing, setIsFollowing] = useState(follow);
  const followingRef = useRef(follow);
  // Set by a re-centre: glide to the vehicle instead of jumping to it.
  const catchingUpRef = useRef(false);
  useEffect(() => {
    followingRef.current = follow;
    setIsFollowing(follow);
    if (!map) {
      return;
    }
    const stopFollowing = () => {
      if (followingRef.current) {
        followingRef.current = false;
        catchingUpRef.current = false;
        setIsFollowing(false);
      }
    };
    map.on("mousedown", stopFollowing);
    map.on("touchstart", stopFollowing);
    map.on("dragstart", stopFollowing);
    return () => {
      map.off("mousedown", stopFollowing);
      map.off("touchstart", stopFollowing);
      map.off("dragstart", stopFollowing);
    };
  }, [follow, map]);

  const recenter = useCallback(() => {
    catchingUpRef.current = true;
    followingRef.current = true;
    setIsFollowing(true);
  }, []);

  // A new trip starts from the start.
  useEffect(() => {
    if (!rideId) {
      return;
    }
    shownRef.current = 0;
    motionRef.current = { from: 0, startedAt: 0, to: 0 };
    // ...with the camera on the vehicle, whatever was done to the last one.
    followingRef.current = followRef.current;
    setIsFollowing(followRef.current);
  }, [rideId]);

  // The latest marker getter, so a new function each render does not
  // restart the animation.
  const getMarkersRef = useRef(getMarkers);
  useEffect(() => {
    getMarkersRef.current = getMarkers;
  }, [getMarkers]);

  useEffect(() => {
    if (!(map && route && rideId)) {
      return;
    }

    let frame = 0;
    let lastLineAt = 0;
    // The pins that have been moved apart, so they can be put back.
    const offsetMarkers = new Set<maplibregl.Marker>();

    const draw = (now: number) => {
      const motion = motionRef.current;
      const progress = Math.min(1, (now - motion.startedAt) / SIM_TICK_MS);
      const meters = motion.from + (motion.to - motion.from) * progress;
      shownRef.current = meters;

      const point = pointAlong(route, meters);
      placeRiders(getMarkersRef.current(), point, offsetMarkers);

      if (followingRef.current) {
        followCamera(map, point, catchingUpRef);
      }

      if (now - lastLineAt >= LINE_REDRAW_MS) {
        lastLineAt = now;
        drawRemainingRoad(map, remainingLine(route, meters));
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      for (const marker of offsetMarkers) {
        marker.setOffset([0, 0]);
      }
    };
  }, [map, rideId, route]);

  const isSimulating = Boolean(rideId && simulation);
  const remainingMeters = simulation?.ready
    ? Math.max(0, simulation.totalMeters - simulation.traveledMeters)
    : null;
  const hasArrived = Boolean(simulation?.arrivedAt);

  let etaSeconds: number | null = null;
  if (hasArrived) {
    etaSeconds = 0;
  } else if (remainingMeters !== null && simulation) {
    etaSeconds = secondsRemaining(remainingMeters, simulation.speedKmh);
  }

  return {
    etaSeconds,
    hasArrived,
    isFollowing,
    isSimulating,
    recenter,
    remainingMeters: hasArrived ? 0 : remainingMeters,
  };
}
