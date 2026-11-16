/**
 * The road on the map.
 *
 * Both the passenger and the operator look at the same journey, so the road
 * is drawn by one piece of code. When each screen had its own copy, they
 * drifted: the operator was shown a road to the passenger's live position
 * while the passenger was shown a road to the pickup, and neither was the road
 * the driver was actually taking.
 */

import type { GeoJSONSource } from "maplibre-gl";
import type { RouteGeometry } from "@/lib/mapClient";

/**
 * The road is drawn by *updating* the layers that are already on the map.
 *
 * It used to be drawn by taking the layers off and putting them back. On a
 * moving vehicle that is a strobe: the road vanished and came back every few
 * seconds, because the road is redrawn on a slow cadence and whenever the
 * vehicle has moved far enough for the road to have changed.
 *
 * MapLibre can put new geometry into a source that is already there, so the
 * layers stay and only the data changes. The road moves; it never blinks.
 */

/** Which leg of the journey the driver is on. */
export type RoutePhase = "toPickup" | "toDestination";

export interface RouteLeg {
  phase: RoutePhase;
  /** Where the vehicle is going. */
  target: { latitude: number; longitude: number } | null;
}

export interface RouteStyle {
  /** The dark line under the route, which is what makes it read as a route. */
  casingColor: string;
  /** The bright line on top. */
  color: string;
  width: number;
}

/**
 * The collecting leg is green and the carrying leg is blue.
 *
 * A change of colour is an unmistakable signal that the plan has changed, and
 * the operator does not have to read the line to know which leg they are on.
 */
export const ROUTE_STYLES: Record<RoutePhase, RouteStyle> = {
  toDestination: { casingColor: "#0c4a6e", color: "#38bdf8", width: 5 },
  toPickup: { casingColor: "#064e3b", color: "#34d399", width: 5 },
};

export const ROUTE_LAYER_ID = "route-line";
export const ROUTE_CASING_LAYER_ID = "route-line-casing";
export const ROUTE_SOURCE_ID = "route";

/**
 * An empty road.
 *
 * This is what the source holds when there is no road to draw. Blanking the
 * source is how the road goes away without the layers being taken off the map.
 */
export const EMPTY_ROUTE_GEOMETRY = {
  type: "LineString" as const,
  coordinates: [] as [number, number][],
};

/**
 * The parts of a ride the route is drawn between.
 */
export interface RouteRide {
  dropoff: { latitude: number; longitude: number };
  pickup: { latitude: number; longitude: number };
  status: string;
}

/**
 * The leg a ride is on.
 *
 * While the driver is collecting, the road runs from where they are to the
 * pickup point — not to where the passenger happens to be standing, which is
 * a different place. Once the passenger is on board, the road runs to the
 * destination.
 *
 * The origin is not part of the leg: the vehicle is the origin of both roads.
 */
export function routeLegForRide(ride: RouteRide | null): RouteLeg {
  if (!ride) {
    return { phase: "toPickup", target: null };
  }

  const phase: RoutePhase =
    ride.status === "inProgress" ? "toDestination" : "toPickup";

  return {
    phase,
    target: phase === "toPickup" ? ride.pickup : ride.dropoff,
  };
}

/**
 * Whether the map can still be drawn on.
 *
 * A map that has been removed has no style, and every call into it throws:
 * MapLibre's own `getSource` reads `this.style`, which is gone. The map is
 * removed when the page goes away, and the road is torn down separately, so
 * the two can happen in either order — and the road must never be the thing
 * that breaks the page.
 *
 * MapLibre's own `getStyle` answers this without throwing: it returns
 * nothing when the style is gone.
 */
export function canDrawOn(map: maplibregl.Map | null): map is maplibregl.Map {
  return Boolean(map?.getStyle());
}

/**
 * The source the road lives in.
 *
 * It is always a GeoJSON source — this module is the only thing that creates
 * it — but MapLibre describes every source as the same shape, so this is
 * where that guarantee is recorded.
 */
function routeSource(map: maplibregl.Map | null): GeoJSONSource | undefined {
  if (!canDrawOn(map)) {
    return;
  }
  return map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
}

/**
 * Whether the road is on the map.
 *
 * A theme change replaces the whole style, which takes the road with it. This
 * is how the drawing code notices that the road needs putting back.
 */
export function routeLayersExist(map: maplibregl.Map | null): boolean {
  if (!canDrawOn(map)) {
    return false;
  }
  return Boolean(
    map.getLayer(ROUTE_LAYER_ID) &&
      map.getLayer(ROUTE_CASING_LAYER_ID) &&
      map.getSource(ROUTE_SOURCE_ID)
  );
}

/**
 * Puts the road on the map, if it is not already there.
 *
 * The layers are added once and then left alone for the rest of the ride.
 */
export function ensureRouteLayers(
  map: maplibregl.Map | null,
  phase: RoutePhase
): void {
  if (!canDrawOn(map) || routeLayersExist(map)) {
    return;
  }

  const style = ROUTE_STYLES[phase];

  if (!map.getSource(ROUTE_SOURCE_ID)) {
    map.addSource(ROUTE_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: EMPTY_ROUTE_GEOMETRY,
      },
    });
  }

  map.addLayer({
    id: ROUTE_LAYER_ID,
    type: "line",
    source: ROUTE_SOURCE_ID,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": style.color,
      "line-width": style.width,
      "line-opacity": 0.9,
    },
  });

  map.addLayer({
    id: ROUTE_CASING_LAYER_ID,
    type: "line",
    source: ROUTE_SOURCE_ID,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": style.casingColor,
      "line-width": style.width + 4,
      "line-opacity": 0.9,
    },
  });
}

/**
 * Recolours the road for the leg it is on.
 *
 * The colour is the signal that the plan has changed, and it has to change
 * without the road being taken off the map.
 */
export function applyRoutePhase(
  map: maplibregl.Map | null,
  phase: RoutePhase
): void {
  if (!canDrawOn(map)) {
    return;
  }
  const style = ROUTE_STYLES[phase];

  if (map.getLayer(ROUTE_LAYER_ID)) {
    map.setPaintProperty(ROUTE_LAYER_ID, "line-color", style.color);
  }
  if (map.getLayer(ROUTE_CASING_LAYER_ID)) {
    map.setPaintProperty(
      ROUTE_CASING_LAYER_ID,
      "line-color",
      style.casingColor
    );
  }
}

/**
 * Puts a new road in the layers that are already on the map.
 *
 * This is what a redraw is: the geometry changes, the layers do not.
 */
export function updateRouteGeometry(
  map: maplibregl.Map | null,
  geometry: RouteGeometry,
  phase: RoutePhase
): void {
  if (!canDrawOn(map)) {
    return;
  }

  ensureRouteLayers(map, phase);

  routeSource(map)?.setData({
    type: "Feature",
    properties: {},
    geometry,
  });

  applyRoutePhase(map, phase);
}

/**
 * Draws the road on the map.
 *
 * Kept as the name the rest of the app uses; it updates the road in place.
 */
export function drawHighlightedRoute(
  map: maplibregl.Map | null,
  geometry: RouteGeometry,
  phase: RoutePhase
): void {
  updateRouteGeometry(map, geometry, phase);
}

/**
 * Takes the road off the map, leaving the layers where they are.
 *
 * The layers are cheap and the data is not: blanking the source is what makes
 * the road disappear without a strobe.
 */
export function clearRouteLine(map: maplibregl.Map | null): void {
  if (!canDrawOn(map)) {
    return;
  }
  routeSource(map)?.setData({
    type: "Feature",
    properties: {},
    geometry: EMPTY_ROUTE_GEOMETRY,
  });
}

/**
 * Removes the road and its layers from the map entirely.
 *
 * This is the teardown, not the redraw. Taking the layers off is only right
 * when the map itself is going away.
 */
export function removeRouteLayers(map: maplibregl.Map | null): void {
  if (!canDrawOn(map)) {
    return;
  }
  if (map.getLayer(ROUTE_CASING_LAYER_ID)) {
    map.removeLayer(ROUTE_CASING_LAYER_ID);
  }
  if (map.getLayer(ROUTE_LAYER_ID)) {
    map.removeLayer(ROUTE_LAYER_ID);
  }
  if (map.getSource(ROUTE_SOURCE_ID)) {
    map.removeSource(ROUTE_SOURCE_ID);
  }
}
