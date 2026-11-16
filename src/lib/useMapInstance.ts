"use client";

import maplibregl from "maplibre-gl";
import { type RefObject, useEffect, useRef } from "react";
import { addLandmarkMarkers } from "@/lib/mapMarkers";
import { applyMapStyle, styleForTheme } from "@/lib/mapStyle";

interface UseMapInstanceOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  landmarkMarkersRef: RefObject<maplibregl.Marker[]>;
  mapRef: RefObject<maplibregl.Map | null>;
  /**
   * Called with the new map instance whenever the map is built, and with
   * null when it is torn down. Consumers that draw onto the map need the
   * instance itself: anything drawn on the old map is lost with it.
   */
  onMapReady: (map: maplibregl.Map | null) => void;
  theme: string;
}

/**
 * Creates the map once and tears it down when the page unmounts. Without the
 * teardown every navigation leaves a live MapLibre instance behind.
 *
 * The map is created once and never rebuilt. The theme only swaps the style
 * on the existing instance: rebuilding it would throw away the WebGL context
 * and every marker that was drawn on it, and it left the map showing the
 * wrong style for the whole session.
 *
 * Both maps use this one. The driver map used to have its own copy of the
 * whole thing, and the two could not agree about anything.
 */
export function useMapInstance({
  containerRef,
  landmarkMarkersRef,
  mapRef,
  onMapReady,
  theme,
}: UseMapInstanceOptions): void {
  const appliedStyleRef = useRef<string | null>(null);

  // The callback is read through a ref rather than depended on directly.
  //
  // A caller that passes an inline arrow — which is the natural thing to do —
  // would otherwise change the callback on every render, and the teardown
  // effect below would run on every render too: the map would be taken down
  // and built again each time, and anything that drew onto it would find it
  // gone.
  const onMapReadyRef = useRef(onMapReady);
  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) {
      return;
    }

    appliedStyleRef.current = styleForTheme(theme);

    const mapInstance = new maplibregl.Map({
      container,
      style: appliedStyleRef.current,
      center: [122.0175, 10.7883],
      zoom: 13,
    });
    mapRef.current = mapInstance;
    onMapReadyRef.current(mapInstance);

    mapInstance.on("load", () => {
      addLandmarkMarkers(mapInstance, landmarkMarkersRef.current);
    });
  }, [containerRef, landmarkMarkersRef, mapRef, theme]);

  useEffect(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance) {
      return;
    }

    const style = styleForTheme(theme);
    if (appliedStyleRef.current === style) {
      return;
    }
    appliedStyleRef.current = style;

    applyMapStyle(mapInstance, theme);
  }, [mapRef, theme]);

  useEffect(
    () => () => {
      for (const marker of landmarkMarkersRef.current) {
        marker.remove();
      }
      landmarkMarkersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      onMapReadyRef.current(null);
    },
    [landmarkMarkersRef, mapRef]
  );
}
