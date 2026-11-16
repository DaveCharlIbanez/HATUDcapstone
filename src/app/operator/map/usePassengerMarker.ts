"use client";

import maplibregl from "maplibre-gl";
import { type RefObject, useEffect, useRef } from "react";
import {
  COMMUTER_PIN_COLOR,
  COMMUTER_PIN_GLYPH,
  createPartnerMarkerElement,
  MOVING_MARKER_OPTIONS,
  setMarkerStale,
} from "@/lib/mapMarkers";

/** A position older than this is drawn greyed out. */
const LOCATION_STALE_MS = 30_000;

/** The pin for the pickup point. */
const PICKUP_PIN_COLOR = "#10B981";

/** The pin for the destination. */
const DROPOFF_PIN_COLOR = "#EF4444";

/** The passenger's last reported position, as the server holds it. */
export interface PassengerLocation {
  latitude: number;
  longitude: number;
  updatedAt: number;
}

/** The two ends of the ride, as the driver sees them. */
export interface RideEndpoints {
  dropoff: { latitude: number; longitude: number };
  pickup: { latitude: number; longitude: number };
}

interface UsePassengerMarkerOptions {
  /** The passenger's position, if there is one. */
  commuterLocation: PassengerLocation | null;
  /** The ride is over — the pins come off the map. */
  isRideLive: boolean;
  /**
   * The trip is under way. The simulation moves the passenger's pin smoothly,
   * so it is only created here, never moved.
   */
  isTripUnderWay?: boolean;
  mapRef: RefObject<maplibregl.Map | null>;
  /** Where the ride is going. */
  rideEndpoints: RideEndpoints | null;
}

/**
 * Puts the passenger's pin on the map, or moves it.
 *
 * During the trip the simulation moves the pin smoothly, so here it is only
 * created, never moved — moving it here as well would make it hop.
 */
function placePassengerPin(
  markerRef: RefObject<maplibregl.Marker | null>,
  mapInstance: maplibregl.Map,
  location: PassengerLocation,
  isTripUnderWay: boolean
): void {
  const position: [number, number] = [location.longitude, location.latitude];
  if (!markerRef.current) {
    markerRef.current = new maplibregl.Marker({
      ...MOVING_MARKER_OPTIONS,
      element: createPartnerMarkerElement(
        COMMUTER_PIN_GLYPH,
        COMMUTER_PIN_COLOR
      ),
    })
      .setLngLat(position)
      .addTo(mapInstance);
  } else if (!isTripUnderWay) {
    markerRef.current.setLngLat(position);
  }

  // During a demo trip the passenger's GPS is no longer sent: the simulation
  // drives the pin, so an old position does not make it stale (fixoct52).
  setMarkerStale(
    markerRef.current.getElement(),
    !isTripUnderWay && Date.now() - location.updatedAt > LOCATION_STALE_MS,
    COMMUTER_PIN_COLOR
  );
}

/**
 * The pins for the other party and the two ends of the ride.
 *
 * The passenger's pin is where they are; the pickup and the destination pins
 * are where the ride is going. Without the two ends on the map, the driver
 * has no on-screen indication of the destination — the road only told them
 * where the passenger was standing.
 */
export function usePassengerMarker({
  commuterLocation,
  isRideLive,
  isTripUnderWay = false,
  mapRef,
  rideEndpoints,
}: UsePassengerMarkerOptions): RefObject<maplibregl.Marker | null> {
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const pickupRef = useRef<maplibregl.Marker | null>(null);
  const dropoffRef = useRef<maplibregl.Marker | null>(null);
  const markerMapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    const mapInstance = mapRef.current;

    if (!(isRideLive && mapInstance)) {
      return;
    }

    // The map is rebuilt when the theme changes, which takes the old pins
    // with them. A pin that belongs to a previous map has to be recreated.
    if (markerMapRef.current !== mapInstance) {
      markerRef.current?.remove();
      markerRef.current = null;
      pickupRef.current?.remove();
      pickupRef.current = null;
      dropoffRef.current?.remove();
      dropoffRef.current = null;
      markerMapRef.current = mapInstance;
    }

    if (commuterLocation) {
      placePassengerPin(
        markerRef,
        mapInstance,
        commuterLocation,
        isTripUnderWay
      );
    }

    if (rideEndpoints) {
      if (pickupRef.current) {
        pickupRef.current.setLngLat([
          rideEndpoints.pickup.longitude,
          rideEndpoints.pickup.latitude,
        ]);
      } else {
        pickupRef.current = new maplibregl.Marker({
          element: createPartnerMarkerElement("📍", PICKUP_PIN_COLOR),
        })
          .setLngLat([
            rideEndpoints.pickup.longitude,
            rideEndpoints.pickup.latitude,
          ])
          .addTo(mapInstance);
      }

      if (dropoffRef.current) {
        dropoffRef.current.setLngLat([
          rideEndpoints.dropoff.longitude,
          rideEndpoints.dropoff.latitude,
        ]);
      } else {
        dropoffRef.current = new maplibregl.Marker({
          element: createPartnerMarkerElement("📌", DROPOFF_PIN_COLOR),
        })
          .setLngLat([
            rideEndpoints.dropoff.longitude,
            rideEndpoints.dropoff.latitude,
          ])
          .addTo(mapInstance);
      }
    }
  }, [commuterLocation, isRideLive, isTripUnderWay, mapRef, rideEndpoints]);

  // The pins come off the map when the ride ends.
  useEffect(() => {
    if (isRideLive) {
      return;
    }
    markerRef.current?.remove();
    markerRef.current = null;
    pickupRef.current?.remove();
    pickupRef.current = null;
    dropoffRef.current?.remove();
    dropoffRef.current = null;
  }, [isRideLive]);

  return markerRef;
}
