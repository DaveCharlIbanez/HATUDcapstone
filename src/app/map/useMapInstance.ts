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
  theme: string;
}

/**
 * Creates the map once and tears it down when the page unmounts. Without the
 * teardown every navigation leaves a live MapLibre instance behind.
 */
export function useMapInstance({
  containerRef,
  mapRef,
  landmarkMarkersRef,
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

    mapInstance.on("load", () => {
      addLandmarkMarkers(mapInstance, landmarkMarkersRef.current);
    });
  }, [containerRef, landmarkMarkersRef, mapRef, theme]);

  useEffect(
    () => () => {
      for (const marker of landmarkMarkersRef.current) {
        marker.remove();
      }
      landmarkMarkersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [landmarkMarkersRef, mapRef]
  );
}
