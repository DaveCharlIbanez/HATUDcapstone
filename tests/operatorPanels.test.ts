import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/**
 * The driver's panels.
 *
 * The "Navigate" button sent the driver out to Google Maps in a browser. The
 * app draws the road on its own map, so the button took them off the app,
 * away from the chat, the queue and the ride — and it was the only way to
 * see the road to a pickup they had not accepted yet.
 */

const projectRoot = join(import.meta.dirname, "..");

function readProjectFile(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

test("nothing sends the driver out to Google Maps", () => {
  const page = readProjectFile("src/app/operator/map/page.tsx");
  const sheet = readProjectFile("src/app/operator/map/RideDetailSheet.tsx");

  expect(page).not.toContain("google.com/maps");
  expect(sheet).not.toContain("google.com/maps");
  expect(page).not.toContain("handleNavigate");
  expect(sheet).not.toContain("onNavigate");
});

test("the Navigate button is gone from the detail sheet", () => {
  const sheet = readProjectFile("src/app/operator/map/RideDetailSheet.tsx");

  expect(sheet).not.toContain("Navigate");
  // What took its place says where the road is.
  expect(sheet).toContain("drawn on your map");
});

test("the road to the request being looked at is drawn on the driver's map", () => {
  const page = readProjectFile("src/app/operator/map/page.tsx");

  // With no ride yet, the road is the one to the request the driver has
  // selected.
  expect(page).toContain("routeTargetFor");
  expect(page).toContain("selectedRide");
  expect(page).toContain("routeTarget");
});

test("the time the road takes is on the driver's panels", () => {
  const panels = readProjectFile("src/app/operator/map/OperatorPanels.tsx");
  const detail = readProjectFile("src/app/operator/map/RideDetailSheet.tsx");
  const current = readProjectFile("src/app/operator/map/CurrentRidePanel.tsx");
  const queue = readProjectFile("src/app/operator/map/RideQueueSheet.tsx");

  expect(panels).toContain("etas");
  expect(detail).toContain("formatEta");
  expect(current).toContain("formatEta");
  expect(queue).toContain("formatEta");
});

test("the queue is measured with one request for the whole queue", () => {
  const hook = readProjectFile("src/app/operator/map/useQueueEtas.ts");

  // The router's table service answers a whole matrix of journeys at once.
  expect(hook).toContain("getRouteDurations");
  expect(hook).toContain("REFRESH_INTERVAL_MS");
});

test("the panels are one component, and the page is about the map", () => {
  const page = readProjectFile("src/app/operator/map/page.tsx");
  const panels = readProjectFile("src/app/operator/map/OperatorPanels.tsx");

  expect(page).toContain("OperatorPanels");
  expect(panels).toContain("RideQueueSheet");
  expect(panels).toContain("RideDetailSheet");
  expect(panels).toContain("CurrentRidePanel");
  expect(panels).toContain("ChatBubble");
});

test("both maps are built by one hook, so they cannot drift apart", () => {
  const hook = readProjectFile("src/lib/useMapInstance.ts");
  const passenger = readProjectFile("src/app/map/page.tsx");
  const operator = readProjectFile("src/app/operator/map/page.tsx");

  expect(hook).toContain("useMapInstance");
  expect(passenger).toContain("useMapInstance");
  expect(operator).toContain("useMapInstance");
});

test("the driver's map is built before anything draws on it", () => {
  const page = readProjectFile("src/app/operator/map/page.tsx");
  const passenger = readProjectFile("src/app/map/page.tsx");

  // A hook that drew onto a map that did not exist yet would find nothing
  // there, and the road would not appear until the next redraw.
  const driverMap = page.indexOf("useMapInstance(");
  const driverRoute = page.indexOf("useRouteLine(");
  expect(driverMap).toBeGreaterThan(-1);
  expect(driverRoute).toBeGreaterThan(-1);
  expect(driverMap).toBeLessThan(driverRoute);

  const passengerMap = passenger.indexOf("useMapInstance(");
  const passengerRide = passenger.indexOf("useRideLocation(");
  expect(passengerMap).toBeLessThan(passengerRide);
});
