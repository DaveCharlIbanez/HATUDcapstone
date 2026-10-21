import maplibregl from "maplibre-gl";
import { CATEGORY_INFO, landmarks, MUNICIPALITY_LABELS } from "./landmarks";

/**
 * Marker elements for the map. Shared by the operator and commuter maps so
 * both render the same pins.
 */
export function createMarkerElement(color: string, glyph: string): HTMLElement {
  const element = document.createElement("div");
  element.style.width = "30px";
  element.style.height = "30px";
  element.style.backgroundColor = color;
  element.style.borderRadius = "50%";
  element.style.border = "3px solid white";
  element.style.boxShadow = `0 0 8px ${color}80`;
  element.style.cursor = "pointer";
  element.style.display = "flex";
  element.style.alignItems = "center";
  element.style.justifyContent = "center";
  element.style.fontSize = "16px";
  element.textContent = glyph;
  return element;
}

/**
 * A pre-plotted landmark marker.
 */
function createLandmarkMarkerElement(category: string): HTMLElement {
  const categoryInfo = CATEGORY_INFO[category as keyof typeof CATEGORY_INFO];
  const element = document.createElement("div");
  element.style.width = "28px";
  element.style.height = "28px";
  element.style.backgroundColor = categoryInfo.color;
  element.style.borderRadius = "50%";
  element.style.border = "3px solid white";
  element.style.display = "flex";
  element.style.alignItems = "center";
  element.style.justifyContent = "center";
  element.style.fontSize = "14px";
  element.style.cursor = "pointer";
  element.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
  element.style.zIndex = "10";
  element.textContent = categoryInfo.icon;
  return element;
}

/**
 * Plots every landmark on the map.
 *
 * Both the passenger map and the operator map call this, so the two screens
 * cannot drift apart on which landmarks are shown.
 */
export function addLandmarkMarkers(
  map: maplibregl.Map,
  markers: maplibregl.Marker[]
): void {
  for (const landmark of landmarks) {
    const popup = new maplibregl.Popup({
      offset: 25,
      closeButton: false,
    }).setHTML(
      `<div style="font-family:system-ui;padding:4px;">
              <strong style="font-size:13px;">${landmark.name}</strong><br/>
              <span style="color:#666;font-size:11px;">${MUNICIPALITY_LABELS[landmark.municipality]}</span>
            </div>`
    );

    const marker = new maplibregl.Marker({
      element: createLandmarkMarkerElement(landmark.category),
    })
      .setLngLat([landmark.coordinates.lng, landmark.coordinates.lat])
      .setPopup(popup)
      .addTo(map);

    markers.push(marker);
  }
}
