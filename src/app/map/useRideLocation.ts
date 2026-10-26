"use client";

import { useMutation, useQuery } from "convex/react";
import maplibregl from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { getRoute } from "@/lib/mapClient";
import {
  createPartnerMarkerElement,
  createSelfMarkerElement,
  setMarkerStale,
} from "@/lib/mapMarkers";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";

/** How often the rider's position is pushed to the server. */
const LOCATION_PUSH_INTERVAL_MS = 5000;

/** A position older than this is drawn greyed out. */
const LOCATION_STALE_MS = 30_000;

/** How often the road between the driver and the next stop is re-drawn. */
const ROUTE_REDRAW_INTERVAL_MS = 15_000;

const ROUTE_LAYER_ID = "commuter-route";
const ROUTE_SOURCE_ID = "commuter-route";
const OPERATOR_PIN_COLOR = "#2563eb";
const SELF_PIN_COLOR = "#0ea5e9";

interface UseRideLocationOptions {
  activeRide: Doc<"rides"> | null;
  mapInstance: maplibregl.Map | null;
  sessionToken: string | null;
}

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
}: UseRideLocationOptions): void {
  const { showToast } = useToast();
  const [sharingError, setSharingError] = useState<string | null>(null);
  const livePositionRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const operatorMarkerRef = useRef<maplibregl.Marker | null>(null);
  const selfMarkerRef = useRef<maplibregl.Marker | null>(null);
  const markerMapRef = useRef<maplibregl.Map | null>(null);
  const lastRouteDrawRef = useRef(0);
  const lastRouteTargetRef = useRef<string | null>(null);

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
      ? partnerLocation.operatorLocation
      : null;

  // Where the driver is heading: the pickup point until the ride starts, the
  // destination afterwards.
  const routeTarget = useMemo(() => {
    if (!activeRide) {
      return null;
    }
    return activeRide.status === "inProgress"
      ? activeRide.dropoff
      : activeRide.pickup;
  }, [activeRide]);

  const rideId = activeRide?._id ?? null;
  const rideStatus = activeRide?.status ?? null;

  /**
   * Push the rider's position to the server for as long as the ride is live.
   */
  useEffect(() => {
    const isLive = rideStatus === "accepted" || rideStatus === "inProgress";
    if (!(isLive && rideId && sessionToken)) {
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
          "Location sharing is off, so your driver cannot see where you are."
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
  }, [rideId, rideStatus, sessionToken, updateCommuterLocationMutation]);

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
   * Draw the driver's live position and the road to the next stop.
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
      lastRouteDrawRef.current = 0;
    }

    const clearRoute = () => {
      if (mapInstance.getLayer(ROUTE_LAYER_ID)) {
        mapInstance.removeLayer(ROUTE_LAYER_ID);
      }
      if (mapInstance.getSource(ROUTE_SOURCE_ID)) {
        mapInstance.removeSource(ROUTE_SOURCE_ID);
      }
    };

    if (!operatorLocation) {
      operatorMarkerRef.current?.remove();
      operatorMarkerRef.current = null;
      selfMarkerRef.current?.remove();
      selfMarkerRef.current = null;
      clearRoute();
      return;
    }

    const position: [number, number] = [
      operatorLocation.longitude,
      operatorLocation.latitude,
    ];

    if (operatorMarkerRef.current) {
      operatorMarkerRef.current.setLngLat(position);
    } else {
      operatorMarkerRef.current = new maplibregl.Marker({
        element: createPartnerMarkerElement("🏍️", OPERATOR_PIN_COLOR),
      })
        .setLngLat(position)
        .addTo(mapInstance);
    }

    setMarkerStale(
      operatorMarkerRef.current.getElement(),
      Date.now() - operatorLocation.updatedAt > LOCATION_STALE_MS,
      OPERATOR_PIN_COLOR
    );

    // The rider's own position, so the driver and the destination can be
    // read against each other.
    const live = livePositionRef.current;
    if (live) {
      const selfPosition: [number, number] = [live.longitude, live.latitude];
      if (selfMarkerRef.current) {
        selfMarkerRef.current.setLngLat(selfPosition);
      } else {
        selfMarkerRef.current = new maplibregl.Marker({
          element: createSelfMarkerElement(SELF_PIN_COLOR),
        })
          .setLngLat(selfPosition)
          .addTo(mapInstance);
      }
    }

    if (!routeTarget) {
      return;
    }

    // The road is redrawn on a slower cadence than the marker moves, so a
    // moving driver does not trigger a route request every few seconds.
    const targetKey = `${routeTarget.latitude},${routeTarget.longitude}`;
    const now = Date.now();
    const targetChanged = lastRouteTargetRef.current !== targetKey;
    if (
      !targetChanged &&
      now - lastRouteDrawRef.current < ROUTE_REDRAW_INTERVAL_MS
    ) {
      return;
    }
    lastRouteTargetRef.current = targetKey;
    lastRouteDrawRef.current = now;

    const drawRoute = async () => {
      const route = await getRoute(position, [
        routeTarget.longitude,
        routeTarget.latitude,
      ]);
      if (!(route && mapInstance)) {
        return;
      }
      clearRoute();
      mapInstance.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: route },
      });
      mapInstance.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": OPERATOR_PIN_COLOR,
          "line-width": 4,
          "line-opacity": 0.7,
        },
      });
    };

    drawRoute();
  }, [mapInstance, operatorLocation, routeTarget]);
}
