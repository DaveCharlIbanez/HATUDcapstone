import { Capacitor } from "@capacitor/core";
import maplibregl from "maplibre-gl";
import type { RefObject } from "react";

interface LocateUserOptions {
  map: RefObject<maplibregl.Map | null>;
  onError: (message: string) => void;
  onLocated: (coords: { lat: number; lng: number }, label: string) => void;
  onLocatingChange: (locating: boolean) => void;
  userMarkerRef: RefObject<maplibregl.Marker | null>;
}

/**
 * Where the setting lives.
 *
 * On a phone the permission belongs to the app, so the instruction is the
 * device's settings. In a browser it belongs to the browser. Telling a phone
 * user to look in their browser settings sends them to the wrong place.
 */
export function locationSettingsHint(): string {
  return Capacitor.isNativePlatform()
    ? "Turn location on for HATUD in your device settings, then try again."
    : "Turn location on for this site in your browser settings, then try again.";
}

/**
 * What to tell the user when the position cannot be read.
 *
 * The wording has to be right on a phone as well as in a browser: on Android
 * the app asks for the runtime permission and the setting lives in the app's
 * own permission screen, so "your browser settings" sends the reader to the
 * wrong place.
 */
export function describeGeolocationError(code: number): string {
  if (code === 1) {
    return `Location access was refused. ${locationSettingsHint()}`;
  }
  if (code === 2) {
    return "Your location is not available right now. Check that your device's location is on, then try again.";
  }
  if (code === 3) {
    return "Your location took too long to arrive. Please try again.";
  }
  return "Could not get your location. Please try again.";
}

/**
 * Asks the browser where the user is and drops a marker on the map.
 */
export function locateUser({
  map,
  userMarkerRef,
  onLocated,
  onError,
  onLocatingChange,
}: LocateUserOptions): void {
  if (!navigator.geolocation) {
    onError("Geolocation is not supported by your browser");
    return;
  }

  onLocatingChange(true);
  onError("");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { longitude, latitude } = position.coords;
      onLocated(
        { lat: latitude, lng: longitude },
        `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      );

      const mapInstance = map.current;
      if (mapInstance) {
        mapInstance.flyTo({ center: [longitude, latitude], zoom: 14 });

        if (userMarkerRef.current) {
          userMarkerRef.current.setLngLat([longitude, latitude]);
        } else {
          const element = document.createElement("div");
          element.style.width = "20px";
          element.style.height = "20px";
          element.style.backgroundColor = "#0ea5e9";
          element.style.borderRadius = "50%";
          element.style.border = "3px solid white";
          element.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
          userMarkerRef.current = new maplibregl.Marker({ element })
            .setLngLat([longitude, latitude])
            .addTo(mapInstance);
        }
      }
      onLocatingChange(false);
    },
    (error) => {
      onLocatingChange(false);
      onError(describeGeolocationError(error.code));
    },
    { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
  );
}
