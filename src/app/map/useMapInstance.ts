"use client";

import maplibregl from "maplibre-gl";
import { type RefObject, useEffect } from "react";
import { CATEGORY_INFO, landmarks, MUNICIPALITY_LABELS } from "@/lib/landmarks";

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
      for (const landmark of landmarks) {
        const categoryInfo = CATEGORY_INFO[landmark.category];
        const markerEl = document.createElement("div");
        markerEl.style.width = "28px";
        markerEl.style.height = "28px";
        markerEl.style.backgroundColor = categoryInfo.color;
        markerEl.style.borderRadius = "50%";
        markerEl.style.border = "3px solid white";
        markerEl.style.display = "flex";
        markerEl.style.alignItems = "center";
        markerEl.style.justifyContent = "center";
        markerEl.style.fontSize = "14px";
        markerEl.style.cursor = "pointer";
        markerEl.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
        markerEl.style.zIndex = "10";
        markerEl.textContent = categoryInfo.icon;

        const popup = new maplibregl.Popup({
          offset: 25,
          closeButton: false,
        }).setHTML(
          `<div style="font-family:system-ui;padding:4px;">
              <strong style="font-size:13px;">${landmark.name}</strong><br/>
              <span style="color:#666;font-size:11px;">${MUNICIPALITY_LABELS[landmark.municipality]}</span>
            </div>`
        );

        const marker = new maplibregl.Marker({ element: markerEl })
          .setLngLat([landmark.coordinates.lng, landmark.coordinates.lat])
          .setPopup(popup)
          .addTo(mapInstance);

        landmarkMarkersRef.current.push(marker);
      }
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
