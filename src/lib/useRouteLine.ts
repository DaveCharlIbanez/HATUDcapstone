"use client";

import type maplibregl from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { getRoute, type RouteInfo } from "@/lib/mapClient";
import {
  canDrawOn,
  clearRouteLine,
  drawHighlightedRoute,
  type RoutePhase,
  routeLayersExist,
} from "@/lib/mapRoute";
import { distanceMeters } from "../../convex/lib/arrival";

/**
 * How often the road is redrawn.
 *
 * The router is a free public service, and asking it the same question every
 * few seconds is both slow and rude.
 */
const REDRAW_INTERVAL_MS = 15_000;

/**
 * How far the driver has to move before the road is redrawn.
 *
 * Forty metres is about the length of a city block. Below that, the road
 * would not visibly change.
 */
const MIN_ORIGIN_MOVE_M = 40;

interface UseRouteLineOptions {
  /** The map to draw on. It may not exist yet, and it may be replaced. */
  map: maplibregl.Map | null;
  /** Where the vehicle is now. It changes on every fix. */
  origin: { latitude: number; longitude: number } | null;
  phase: RoutePhase;
  /** Where the vehicle is going. */
  target: { latitude: number; longitude: number } | null;
}

/**
 * What the road told us.
 *
 * The router measures the road as it draws it, so the time it takes to drive
 * comes back with it. There is no extra request to make.
 */
export interface RouteLineResult {
  /** The road, as last measured. */
  route: RouteInfo | null;
}

/**
 * Draws the road the vehicle is taking.
 *
 * The road is drawn straight away when the destination or the leg changes,
 * and then follows the vehicle on a slow cadence — and only when the vehicle
 * has actually moved far enough for the road to have changed.
 *
 * It is drawn by putting new geometry into layers that are already on the
 * map, never by taking them off and putting them back. Taking them off is
 * what made the road strobe on a moving vehicle.
 */
export function useRouteLine({
  map,
  origin,
  phase,
  target,
}: UseRouteLineOptions): RouteLineResult {
  const [route, setRoute] = useState<RouteInfo | null>(null);

  const drawnRef = useRef<{
    origin: { latitude: number; longitude: number };
    phase: RoutePhase;
    at: number;
  } | null>(null);

  // The latest fix, read when the road is drawn rather than when the effect
  // last ran, so the road starts from where the vehicle is now.
  const originRef = useRef(origin);
  useEffect(() => {
    originRef.current = origin;
  }, [origin]);

  // The same for where the vehicle is going.
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  // Where the vehicle is going, compared by value rather than by identity.
  //
  // The ride is a fresh object every time the server sends it, which is
  // several times a minute while the vehicle's position is being pushed. A
  // target compared by identity would be a different target every time, and
  // the road would be fetched again and again — which is both slow and rude
  // to a free public service.
  const targetKey = target
    ? `${target.latitude.toFixed(5)},${target.longitude.toFixed(5)}`
    : "";

  const draw = useCallback(async () => {
    const current = originRef.current;
    const goal = targetRef.current;

    if (!(map && current && goal)) {
      return;
    }

    const measured = await getRoute(
      [current.longitude, current.latitude],
      [goal.longitude, goal.latitude]
    );

    // The map may have been rebuilt — or removed — while the router was
    // answering.
    if (!(measured && canDrawOn(map))) {
      return;
    }

    drawHighlightedRoute(map, measured.geometry, phase);
    drawnRef.current = { at: Date.now(), origin: current, phase };
    setRoute({
      distanceMeters: measured.distanceMeters,
      durationSeconds: measured.durationSeconds,
      measuredAt: Date.now(),
    });
  }, [map, phase]);

  // A new destination, or a new leg, is drawn straight away.
  useEffect(() => {
    // The key is empty exactly when there is no destination.
    if (targetKey === "") {
      clearRouteLine(map);
      drawnRef.current = null;
      setRoute(null);
      return;
    }
    draw().catch(() => undefined);
  }, [draw, map, targetKey]);

  // A theme change replaces the whole style, which takes the road with it.
  // The road has to go back, or the map shows no road at all until the next
  // redraw — up to fifteen seconds of nothing.
  useEffect(() => {
    if (!map) {
      return;
    }

    const onStyleChange = () => {
      if (routeLayersExist(map)) {
        return;
      }
      draw().catch(() => undefined);
    };

    map.on("styledata", onStyleChange);
    return () => {
      map.off("styledata", onStyleChange);
    };
  }, [draw, map]);

  // Then it follows the vehicle, on a slow cadence.
  useEffect(() => {
    const interval = setInterval(() => {
      const drawn = drawnRef.current;
      const current = originRef.current;

      if (!current) {
        return;
      }
      if (!drawn) {
        draw().catch(() => undefined);
        return;
      }
      if (distanceMeters(current, drawn.origin) >= MIN_ORIGIN_MOVE_M) {
        draw().catch(() => undefined);
      }
    }, REDRAW_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [draw]);

  // There is deliberately no teardown that clears the road. When the map goes
  // away the road goes with it, and clearing it afterwards means calling into
  // a map that has already been removed — which throws, because a removed map
  // has no style left to read.

  return { route };
}
