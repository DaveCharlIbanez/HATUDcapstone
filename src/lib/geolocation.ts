import maplibregl from "maplibre-gl";
import type { RefObject } from "react";

interface LocateUserOptions {
  map: RefObject<maplibregl.Map | null>;
  onError: (message: string) => void;
  onLocated: (coords: { lat: number; lng: number }, label: string) => void;
  onLocatingChange: (locating: boolean) => void;
  userMarkerRef: RefObject<maplibregl.Marker | null>;
}

function describeGeolocationError(code: number): string {
  if (code === 1) {
    return "Location permission denied. Please allow location access in your browser settings.";
  }
  if (code === 2) {
    return "Location unavailable. Please try again.";
  }
  if (code === 3) {
    return "Location request timed out. Please try again.";
  }
  return "Unable to get location";
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
