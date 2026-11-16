"use client";

import maplibregl from "maplibre-gl";
import { type RefObject, useEffect, useRef } from "react";
import { createMarkerElement } from "@/lib/mapMarkers";

/**
 * The pins for the requests waiting in the queue.
 *
 * Each open request gets a pin on its pickup and a pin on its drop-off, and
 * either pin opens the request. They are the same landmarks the passenger's
 * map shows, so a driver looking at the queue and a rider looking at the map
 * are looking at the same places.
 */
export interface QueueRidePin {
  _id: string;
  dropoff: { latitude: number; longitude: number };
  pickup: { latitude: number; longitude: number };
}

export function useQueueMarkers<TRide extends QueueRidePin>({
  mapRef,
  onSelect,
  rides,
}: {
  mapRef: RefObject<maplibregl.Map | null>;
  onSelect: (ride: TRide) => void;
  rides: TRide[] | undefined;
}): void {
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  // The handler is read when a pin is drawn, so a pin always opens the
  // request it was drawn for.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const mapInstance = mapRef.current;
    if (!(mapInstance && rides)) {
      return;
    }

    for (const marker of markersRef.current.values()) {
      marker.remove();
    }
    markersRef.current.clear();

    for (const ride of rides) {
      const pickupEl = createMarkerElement("#10B981", "📍");
      const pickupMarker = new maplibregl.Marker({ element: pickupEl })
        .setLngLat([ride.pickup.longitude, ride.pickup.latitude])
        .addTo(mapInstance);
      pickupEl.addEventListener("click", () => onSelectRef.current(ride));
      markersRef.current.set(`pickup-${ride._id}`, pickupMarker);

      const dropoffEl = createMarkerElement("#EF4444", "📌");
      const dropoffMarker = new maplibregl.Marker({ element: dropoffEl })
        .setLngLat([ride.dropoff.longitude, ride.dropoff.latitude])
        .addTo(mapInstance);
      dropoffEl.addEventListener("click", () => onSelectRef.current(ride));
      markersRef.current.set(`dropoff-${ride._id}`, dropoffMarker);
    }
  }, [mapRef, rides]);

  // The pins go when the map does.
  useEffect(
    () => () => {
      for (const marker of markersRef.current.values()) {
        marker.remove();
      }
      markersRef.current.clear();
    },
    []
  );
}
