"use client";

import { useMutation, useQuery } from "convex/react";
import maplibregl from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { locationSettingsHint } from "@/lib/geolocation";
import type { RouteInfo } from "@/lib/mapClient";
import {
  COMMUTER_PIN_COLOR,
  COMMUTER_PIN_GLYPH,
  createPartnerMarkerElement,
  DRIVER_PIN_COLOR,
  DRIVER_PIN_GLYPH,
  MOVING_MARKER_OPTIONS,
  setMarkerStale,
} from "@/lib/mapMarkers";
import { routeLegForRide } from "@/lib/mapRoute";
import { tripModeFor } from "@/lib/tripMode";
import { useRouteLine } from "@/lib/useRouteLine";
import {
  type SimulatedVehicle,
  useSimulatedVehicle,
} from "@/lib/useSimulatedVehicle";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import {
  driverHasArrived,
  driverIsStillOnTheWay,
} from "../../../convex/lib/arrival";

/** How often the rider's position is pushed to the server. */
const LOCATION_PUSH_INTERVAL_MS = 5000;

/** A position older than this is drawn greyed out. */
const LOCATION_STALE_MS = 30_000;

interface UseRideLocationOptions {
  activeRide: Doc<"rides"> | null;
  mapInstance: maplibregl.Map | null;
  sessionToken: string | null;
}

/** What the hook hands back to the screen that owns it. */
export interface UseRideLocationResult {
  /** The driver is close enough to the pickup point to be there. */
  isDriverArrived: boolean;
  /** The driver is demonstrably still on the way, so the trip cannot start. */
  isDriverOnTheWay: boolean;
  /** The driver's last reported position, if there is one. */
  operatorLocation: Doc<"rides">["operatorLocation"] | null;
  /** What the road says about the time it takes. */
  route: RouteInfo | null;
  /** The simulated trip, once it has started. */
  trip: SimulatedVehicle;
}

/**
 * How close the driver has to be to the pickup point to count as arrived.
 *
 * A hundred metres is roughly the length of a street block, which is as close
 * as a GPS fix on a phone can honestly claim. The rule itself lives in
 * `convex/lib/arrival.ts`, because the server refuses a confirmation that
 * comes while the driver is still on the way, and the two have to agree.
 */

/**
 * Shares the rider's position with the driver, and shows the driver back.
 *
 * The server can only hand out a position that was sent, so the rider has to
 * push theirs: without that the driver map has nothing to draw. The driver
 * pushes theirs from the driver map, and this hook reads it back here.
 */
export function useRideLocation({
  activeRide,
  mapInstance,
  sessionToken,
}: UseRideLocationOptions): UseRideLocationResult {
  const { showToast } = useToast();
  const [sharingError, setSharingError] = useState<string | null>(null);
  const livePositionRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const operatorMarkerRef = useRef<maplibregl.Marker | null>(null);
  const selfMarkerRef = useRef<maplibregl.Marker | null>(null);
  const markerMapRef = useRef<maplibregl.Map | null>(null);

  const updateCommuterLocationMutation = useMutation(
    api.rides.updateCommuterLocation
  );

  const partnerLocation = useQuery(
    api.rides.getPartnerLocation,
    sessionToken && activeRide
      ? { sessionToken, rideId: activeRide._id }
      : "skip"
  );
  const operatorLocation =
    partnerLocation && "operatorLocation" in partnerLocation
      ? (partnerLocation.operatorLocation ?? null)
      : null;

  // The road the vehicle is taking: to the pickup until the ride starts, the
  // destination afterwards. The same rule the operator's map uses.
  const routeLeg = useMemo(() => routeLegForRide(activeRide), [activeRide]);

  // On a demo trip the vehicle is driven along the road by the server once
  // the trip starts, and the road is drawn from that, shrinking behind the
  // vehicle. A live trip keeps following GPS the whole way.
  // GPS is what moves the pins: while the driver is on the way, and for the
  // whole of a live trip.
  const { isFollowingGps: isTrackingGps, isSimulating: isTripUnderWay } =
    tripModeFor(activeRide);

  // The road the driver is taking, and how long it takes. The router measures
  // the road as it draws it, so the time comes with it. During the trip the
  // simulation draws the road instead.
  const { route } = useRouteLine({
    map: mapInstance,
    origin: operatorLocation,
    phase: routeLeg.phase,
    target: isTripUnderWay ? null : routeLeg.target,
  });

  // The passenger is in the vehicle, so both pins ride along with it.
  const trip = useSimulatedVehicle({
    follow: true,
    getMarkers: () => [operatorMarkerRef.current, selfMarkerRef.current],
    map: mapInstance,
    rideId: isTripUnderWay && activeRide ? activeRide._id : null,
    sessionToken,
  });

  /**
   * The map follows the driver while the ride is live.
   *
   * The road is drawn from wherever the driver is, so a map that does not
   * follow them shows a road they cannot see — the live route is only live if
   * it is on the screen.
   *
   * A rider who takes the map into their own hands keeps it: dragging stops
   * the following, because a map that pulls itself back is a map nobody can
   * read.
   */
  const followingRef = useRef(true);

  useEffect(() => {
    if (!mapInstance) {
      return;
    }
    const onDragStart = () => {
      followingRef.current = false;
    };
    mapInstance.on("dragstart", onDragStart);
    return () => {
      mapInstance.off("dragstart", onDragStart);
    };
  }, [mapInstance]);

  useEffect(() => {
    // During a demo trip the simulation keeps the camera on the vehicle.
    if (
      !(
        mapInstance &&
        isTrackingGps &&
        operatorLocation &&
        followingRef.current
      )
    ) {
      return;
    }
    mapInstance.easeTo({
      center: [operatorLocation.longitude, operatorLocation.latitude],
      duration: 900,
      zoom: 15,
    });
  }, [isTrackingGps, mapInstance, operatorLocation]);

  const rideId = activeRide?._id ?? null;

  /**
   * Push the rider's position to the server while the driver is on the way,
   * and for the whole of a live trip.
   *
   * Once a demo trip starts the passenger is in the vehicle, which the
   * simulation drives, so their GPS is no longer sent.
   */
  useEffect(() => {
    if (!(isTrackingGps && rideId && sessionToken)) {
      return;
    }
    if (!("geolocation" in navigator)) {
      setSharingError(
        "This device cannot share your location, so your driver cannot see you."
      );
      return;
    }

    let warned = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        livePositionRef.current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      },
      (error) => {
        if (warned) {
          return;
        }
        warned = true;
        setSharingError(
          error.code === error.PERMISSION_DENIED
            ? `Location sharing is off, so your driver cannot see where you are. ${locationSettingsHint()}`
            : "Your position could not be determined, so your driver cannot see where you are. Please try again."
        );
        console.error("Location watch failed:", error);
      },
      { enableHighAccuracy: true }
    );

    const pushLocation = async () => {
      const live = livePositionRef.current;
      if (!live) {
        return;
      }
      try {
        await updateCommuterLocationMutation({
          sessionToken,
          rideId,
          latitude: live.latitude,
          longitude: live.longitude,
        });
      } catch (error) {
        console.error("Failed to update commuter location:", error);
      }
    };

    pushLocation();
    const interval = setInterval(pushLocation, LOCATION_PUSH_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isTrackingGps, rideId, sessionToken, updateCommuterLocationMutation]);

  /**
   * The toast is raised from state rather than from the watcher, so a new
   * toast handler never restarts the GPS watcher.
   */
  useEffect(() => {
    if (sharingError) {
      showToast(sharingError, "error");
      setSharingError(null);
    }
  }, [sharingError, showToast]);

  /**
   * Draw the driver's live position.
   *
   * The road is drawn by the shared hook, so both screens show the same road
   * in the same colour.
   */
  useEffect(() => {
    if (!mapInstance) {
      return;
    }

    // The map is rebuilt when the theme changes, which takes the old markers
    // with it. Markers that belong to a previous map have to be recreated.
    if (markerMapRef.current !== mapInstance) {
      operatorMarkerRef.current?.remove();
      operatorMarkerRef.current = null;
      selfMarkerRef.current?.remove();
      selfMarkerRef.current = null;
      markerMapRef.current = mapInstance;
    }

    if (!operatorLocation) {
      operatorMarkerRef.current?.remove();
      operatorMarkerRef.current = null;
      selfMarkerRef.current?.remove();
      selfMarkerRef.current = null;
      return;
    }

    const position: [number, number] = [
      operatorLocation.longitude,
      operatorLocation.latitude,
    ];

    if (operatorMarkerRef.current) {
      // During a demo trip the simulation moves the pin smoothly; setting it
      // here as well would make it hop back and forth.
      if (!isTripUnderWay) {
        operatorMarkerRef.current.setLngLat(position);
      }
    } else {
      operatorMarkerRef.current = new maplibregl.Marker({
        ...MOVING_MARKER_OPTIONS,
        element: createPartnerMarkerElement(DRIVER_PIN_GLYPH, DRIVER_PIN_COLOR),
      })
        .setLngLat(position)
        .addTo(mapInstance);
    }

    // During a demo trip the simulation drives the pin, so an old GPS
    // position does not make it stale.
    setMarkerStale(
      operatorMarkerRef.current.getElement(),
      !isTripUnderWay &&
        Date.now() - operatorLocation.updatedAt > LOCATION_STALE_MS,
      DRIVER_PIN_COLOR
    );

    // The rider's own position, so the driver and the destination can be
    // read against each other.
    const live = livePositionRef.current;
    if (live) {
      const selfPosition: [number, number] = [live.longitude, live.latitude];
      if (selfMarkerRef.current) {
        if (!isTripUnderWay) {
          selfMarkerRef.current.setLngLat(selfPosition);
        }
      } else {
        selfMarkerRef.current = new maplibregl.Marker({
          ...MOVING_MARKER_OPTIONS,
          element: createPartnerMarkerElement(
            COMMUTER_PIN_GLYPH,
            COMMUTER_PIN_COLOR
          ),
        })
          .setLngLat(selfPosition)
          .addTo(mapInstance);
      }
    }
  }, [isTripUnderWay, mapInstance, operatorLocation]);

  // Where the driver has got to, and whether that means the trip can start.
  //
  // It only matters while the ride is waiting for the passenger's
  // confirmation: once the trip has begun, the driver is on the road to the
  // destination and the question no longer arises.
  const arrival = activeRide
    ? {
        operatorLocation: activeRide.operatorLocation ?? null,
        pickup: activeRide.pickup,
      }
    : null;
  const isWaitingForConfirmation = activeRide?.status === "accepted";

  const isDriverArrived =
    isWaitingForConfirmation && arrival ? driverHasArrived(arrival) : false;

  const isDriverOnTheWay =
    isWaitingForConfirmation && arrival
      ? driverIsStillOnTheWay(arrival)
      : false;

  return { isDriverArrived, isDriverOnTheWay, operatorLocation, route, trip };
}
