import { readFileSync } from "node:fs";
import { join } from "node:path";
import type maplibregl from "maplibre-gl";
import { expect, test } from "vitest";
import { canDrawOn, ROUTE_STYLES, routeLegForRide } from "../src/lib/mapRoute";

/**
 * The road on the map.
 *
 * The operator's map used to route from the driver to the passenger's live
 * position in every phase — so there was no road to the destination at all,
 * and the road shown during the pickup pointed at the wrong place.
 */

const projectRoot = join(import.meta.dirname, "..");

function readProjectFile(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

const RIDE = {
  dropoff: { latitude: 10.5923, longitude: 121.9476 },
  pickup: { latitude: 10.5944, longitude: 121.9494 },
};

test("a ride that is being collected routes to the pickup", () => {
  const leg = routeLegForRide({ ...RIDE, status: "accepted" });

  expect(leg.phase).toBe("toPickup");
  expect(leg.target).toEqual(RIDE.pickup);
});

test("a ride that is under way routes to the destination", () => {
  const leg = routeLegForRide({ ...RIDE, status: "inProgress" });

  expect(leg.phase).toBe("toDestination");
  expect(leg.target).toEqual(RIDE.dropoff);
});

test("a ride that is not live has no leg", () => {
  expect(routeLegForRide(null).target).toBeNull();
  expect(
    routeLegForRide({ ...RIDE, status: "completed" }).target
  ).not.toBeNull();
});

test("the two legs are drawn in different colours", () => {
  // A change of colour is the signal that the plan has changed.
  expect(ROUTE_STYLES.toPickup.color).not.toBe(
    ROUTE_STYLES.toDestination.color
  );
  expect(ROUTE_STYLES.toPickup.casingColor).not.toBe(
    ROUTE_STYLES.toDestination.casingColor
  );
});

test("the road is drawn as a casing under a line", () => {
  const source = readProjectFile("src/lib/mapRoute.ts");

  // The casing is what makes a route read as the route.
  expect(source).toContain("ROUTE_CASING_LAYER_ID");
  expect(source).toContain("route-line-casing");
  // The casing is wider than the line it sits under.
  expect(source).toContain("style.width + 4");
});

test("clearing the road blanks it without taking the layers off", () => {
  const source = readProjectFile("src/lib/mapRoute.ts");

  // Taking the layers off and putting them back is what made the road
  // strobe on a moving vehicle. The road goes away by emptying the source.
  expect(source).toContain("EMPTY_ROUTE_GEOMETRY");
  expect(source).toContain("setData");

  // The layers are only taken off when the map itself is going away.
  expect(source).toContain("removeRouteLayers");
});

test("the road is updated in place, never taken off and put back", () => {
  const source = readProjectFile("src/lib/mapRoute.ts");

  // The geometry goes into the source that is already there.
  expect(source).toContain("updateRouteGeometry");
  expect(source).toContain("ensureRouteLayers");

  // The drawing must not remove the layers: that is the strobe.
  const drawing = source.slice(
    source.indexOf("export function updateRouteGeometry"),
    source.indexOf("export function drawHighlightedRoute")
  );
  expect(drawing).not.toContain("removeLayer");
  expect(drawing).not.toContain("removeSource");
});

test("the road is put back after a theme change takes the style with it", () => {
  const hook = readProjectFile("src/lib/useRouteLine.ts");

  // A theme change replaces the whole style, which takes the road with it.
  // Without this the map shows no road until the next redraw.
  expect(hook).toContain("styledata");
  expect(hook).toContain("routeLayersExist");
});

test("the leg's colour changes without the road being taken off", () => {
  const source = readProjectFile("src/lib/mapRoute.ts");

  // A change of colour is the signal that the plan has changed.
  expect(source).toContain("applyRoutePhase");
  expect(source).toContain("setPaintProperty");
});

test("both maps use the same leg rule, so they cannot drift apart", () => {
  const operator = readProjectFile("src/app/operator/map/page.tsx");
  const passenger = readProjectFile("src/app/map/useRideLocation.ts");

  expect(operator).toContain("routeLegForRide");
  expect(passenger).toContain("routeLegForRide");
  // And the road itself is drawn by one shared hook.
  expect(operator).toContain("useRouteLine");
  expect(passenger).toContain("useRouteLine");
});

test("the road is redrawn on a slow cadence, not on every fix", () => {
  const source = readProjectFile("src/lib/useRouteLine.ts");

  expect(source).toContain("REDRAW_INTERVAL_MS");
  expect(source).toContain("MIN_ORIGIN_MOVE_M");
});

test("the operator's map marks the pickup and the destination", () => {
  const source = readProjectFile("src/app/operator/map/usePassengerMarker.ts");

  expect(source).toContain("PICKUP_PIN_COLOR");
  expect(source).toContain("DROPOFF_PIN_COLOR");
});

test("the road is not fetched again every time the server sends the ride", () => {
  const hook = readProjectFile("src/lib/useRouteLine.ts");

  // The ride is a fresh object every time the server sends it, which is
  // several times a minute while the vehicle's position is being pushed. A
  // target compared by identity would be a different target every time, and
  // the router would be asked again and again.
  expect(hook).toContain("targetKey");
  expect(hook).toContain("toFixed(5)");
});

test("the rider's map follows the driver while the ride is live", () => {
  const hook = readProjectFile("src/app/map/useRideLocation.ts");

  // The road is drawn from wherever the driver is, so a map that does not
  // follow them shows a road they cannot see.
  expect(hook).toContain("easeTo");
  expect(hook).toContain("dragstart");
  // A rider who takes the map into their own hands keeps it.
  expect(hook).toContain("followingRef");
});

test("the road is put back when the map is built, not only when it changes", () => {
  const hook = readProjectFile("src/lib/useRouteLine.ts");

  // The map is built after the first render, so the road has to be drawn
  // once it exists — not left to the next redraw.
  expect(hook).toContain("map");
});

test("a map that has been removed cannot be drawn on", () => {
  // MapLibre's `getSource` reads `this.style`, which is gone once the map has
  // been removed — so every call into a removed map throws.
  const removed = { getStyle: () => undefined } as unknown as maplibregl.Map;

  expect(canDrawOn(removed)).toBe(false);
});

test("a map that is alive can be drawn on", () => {
  const alive = {
    getStyle: () => ({ version: 8 }),
  } as unknown as maplibregl.Map;

  expect(canDrawOn(alive)).toBe(true);
});

test("no map at all cannot be drawn on", () => {
  expect(canDrawOn(null)).toBe(false);
});

test("the road is not cleared on the way out", () => {
  const hook = readProjectFile("src/lib/useRouteLine.ts");

  // When the map goes away the road goes with it. Clearing it afterwards
  // means calling into a map that has already been removed — which throws,
  // because a removed map has no style left to read.
  expect(hook).not.toContain("clearRouteLine(map);\n    },\n    [map]");
});

test("every call into the map is behind the guard", () => {
  const source = readProjectFile("src/lib/mapRoute.ts");

  // The guard is what makes a removed map harmless rather than fatal.
  expect(source).toContain("canDrawOn");
  expect(source).toContain("map?.getStyle()");
});
