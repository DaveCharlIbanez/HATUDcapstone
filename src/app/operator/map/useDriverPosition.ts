"use client";

import { useMutation } from "convex/react";
import type maplibregl from "maplibre-gl";
import { type RefObject, useEffect, useRef, useState } from "react";
import { locationSettingsHint } from "@/lib/geolocation";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export interface DriverLocation {
  latitude: number;
  longitude: number;
}

interface UseDriverPositionOptions {
  /**
   * The trip is under way and the simulation is driving the vehicle, so GPS
   * must not move the driver's pin.
   */
  holdMarker?: boolean;
  /** The map, so the driver can be centred on their first fix. */
  mapRef: RefObject<maplibregl.Map | null>;
  /** The driver's own marker, so it follows them. */
  userMarkerRef: RefObject<maplibregl.Marker | null>;
}

/**
 * The driver's own position, and whether it is being shared.
 *
 * The driver has to know when their position is *not* being shared: the
 * passenger cannot see a driver the server has no position for, and without a
 * message the driver carries on working a trip the passenger is watching
 * nobody arrive.
 */
export function useDriverPosition({
  holdMarker = false,
  mapRef,
  userMarkerRef,
}: UseDriverPositionOptions): {
  currentLocation: DriverLocation | null;
  driverLocation: [number, number] | null;
  locationError: string | null;
  locationRef: RefObject<DriverLocation | null>;
} {
  const locationRef = useRef<DriverLocation | null>(null);
  const [currentLocation, setCurrentLocation] = useState<DriverLocation | null>(
    null
  );
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(
    null
  );
  const [locationError, setLocationError] = useState<string | null>(null);

  // Read inside the GPS callback, so changing it does not restart the watch.
  const holdMarkerRef = useRef(holdMarker);
  useEffect(() => {
    holdMarkerRef.current = holdMarker;
  }, [holdMarker]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationError(
        "This device cannot share your location, so your passenger cannot see you."
      );
      return;
    }

    let hasCentred = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        const newLocation = { latitude, longitude };
        locationRef.current = newLocation;
        setDriverLocation([longitude, latitude]);
        setCurrentLocation(newLocation);
        setLocationError(null);

        if (userMarkerRef.current && !holdMarkerRef.current) {
          userMarkerRef.current.setLngLat([longitude, latitude]);
        }

        // Centre the map on the first fix only, otherwise the camera is
        // dragged around by every GPS sample.
        if (!hasCentred) {
          hasCentred = true;
          mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 13 });
        }
      },
      (error) => {
        console.error(error);
        // A refusal and a missing fix are different problems. A driver whose
        // permission was refused has to change a setting; a driver whose
        // device cannot get a fix just has to move somewhere with a signal.
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? `Location access was refused. ${locationSettingsHint()}`
            : "Your position could not be determined right now, so your passenger cannot see you. Please try again."
        );
      },
      { enableHighAccuracy: true }
    );

    return () => {
      // Leaving the watcher running keeps the GPS radio on and keeps
      // writing to a component that is no longer mounted.
      navigator.geolocation.clearWatch(watchId);
    };
  }, [mapRef, userMarkerRef]);

  return {
    currentLocation,
    driverLocation,
    locationError,
    locationRef,
  };
}

/** How often the driver's position is sent while it is being shared. */
const SEND_INTERVAL_MS = 5000;

/**
 * Sends the driver's position to the server every five seconds.
 *
 * It runs while the driver heads to the pickup, and for the whole of a live
 * trip. Once a demo trip starts, the simulation drives the vehicle and the
 * position is no longer sent — `send` is false then.
 */
export function useSendDriverLocation({
  locationRef,
  ride,
  send,
  sessionToken,
}: {
  locationRef: RefObject<DriverLocation | null>;
  ride: { _id: Id<"rides"> } | null;
  send: boolean;
  sessionToken: string | null;
}): void {
  const updateOperatorLocation = useMutation(api.rides.updateOperatorLocation);
  const rideId = send && ride ? ride._id : null;

  useEffect(() => {
    if (!(rideId && sessionToken)) {
      return;
    }

    const sendLocation = async () => {
      const loc = locationRef.current;
      if (!loc) {
        return;
      }
      try {
        await updateOperatorLocation({
          sessionToken,
          rideId,
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
      } catch (error) {
        console.error("Failed to update operator location:", error);
      }
    };

    sendLocation();
    const interval = setInterval(sendLocation, SEND_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [locationRef, rideId, sessionToken, updateOperatorLocation]);
}
