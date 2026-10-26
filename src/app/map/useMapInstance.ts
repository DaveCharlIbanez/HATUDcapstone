"use client";

import maplibregl from "maplibre-gl";
import { type RefObject, useEffect } from "react";
import { addLandmarkMarkers } from "@/lib/mapMarkers";

const DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";
const LIGHT_STYLE = "https://tiles.openfreemap.org/styles/bright";

interface UseMapInstanceOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  landmarkMarkersRef: RefObject<maplibregl.Marker[]>;
  mapRef: RefObject<maplibregl.Map | null>;
  /**
   * Called with the new map instance whenever the map is built, and with
   * null when it is torn down. Consumers that draw onto the map need the
   * instance itself: the map is rebuilt when the theme changes, and
   * anything drawn on the old map is lost with it.
   */
  onMapReady: (map: maplibregl.Map | null) => void;
  theme: string;
}

/**
 * Creates the map once and tears it down when the page unmounts. Without the
 * teardown every navigation leaves a live MapLibre instance behind.
 */
export function useMapInstance({
  containerRef,
  landmarkMarkersRef,
  mapRef,
  onMapReady,
  theme,
}: UseMapInstanceOptions): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) {
      return;
    }

    const mapInstance = new maplibregl.Map({
      container,
      style: theme === "dark" ? DARK_STYLE : LIGHT_STYLE,
      center: [122.0175, 10.7883],
      zoom: 13,
    });
    mapRef.current = mapInstance;
    onMapReady(mapInstance);

    mapInstance.on("load", () => {
      addLandmarkMarkers(mapInstance, landmarkMarkersRef.current);
    });
  }, [containerRef, landmarkMarkersRef, mapRef, onMapReady, theme]);

  useEffect(
    () => () => {
      for (const marker of landmarkMarkersRef.current) {
        marker.remove();
      }
      landmarkMarkersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      onMapReady(null);
    },
    [landmarkMarkersRef, mapRef, onMapReady]
  );
}
