# The Live Route, the ETA, and the Driver's Panels — Implementation Plan

**Log ID:** `fixoct40`
**Created:** 2026-11-03 02:50 PST (Tuesday)
**Status:** ✅ Executed
**Result:** `tsc` 0 errors · `ultracite check` 0 errors · 276 tests passing · `next build` OK · verified in a browser
**Related log:** [`FIXOCT40.md`](../FIXOCT40.md) at the repository root
**Previous:** [`FIXOCT39.md`](../FIXOCT39.md) (`fixoct39`)

---

## Overview

Four things came out of one request.

1. **The live road strobed.** The route was drawn by taking its layers off the
   map and putting them back, every fifteen seconds. On a moving vehicle the
   road blinked out and in.
2. **There was no ETA.** The router measures the road as it draws it, and the
   response carries a duration — which the app threw away.
3. **The driver had a "Navigate" button that opened Google Maps**, while the
   app drew its own route on its own map.
4. **There was a fabricated arrival time** on every vehicle card: `"2 min"`,
   `"3 min"`, hardcoded, next to a real fare.

---

## The finding that shaped the work

### 1. The strobe — three causes, all in the drawing code

**The main one** was `src/lib/mapRoute.ts`. Every redraw removed the road and
added it back:

```ts
export function drawHighlightedRoute(map, geometry, phase) {
  clearRouteLine(map);        // removeLayer × 2 + removeSource
  map.addSource(ROUTE_SOURCE_ID, { ... });
  map.addLayer(...);          // addLayer × 2
}
```

`useRouteLine` redraws every **15 s**, or as soon as the vehicle has moved
40 m — so the road blinked out and in every few seconds while the vehicle was
moving. That is the strobe.

**The second** was a theme change. `applyMapStyle` calls `mapInstance.setStyle(...)`,
which destroys every source and layer, and `useRouteLine` had no `styledata`
listener — so the road **vanished for up to fifteen seconds** after a theme
change.

**The third** was that the casing and the line were separate layers added in
two calls, so for a moment only the casing existed.

### 2. The ETA was already being thrown away

```ts
interface OsrmResponse {
  routes?: { geometry: RouteGeometry }[];   // ← duration and distance discarded
}
```

The response also carries them. Verified against the live API:

```
"duration": 1007.9,      // seconds
"distance": 18083.2      // metres
```

So the ETA is **free**: the road is already being fetched to draw the map, and
the duration comes back in the same response.

### 3. The Navigate button

`src/app/operator/map/RideDetailSheet.tsx` opened Google Maps in a browser:

```ts
window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
```

The app draws the road on its own map — but **only for the ride the driver is
on**. For an *open request* nothing was drawn, so "Navigate" was the only way
for a driver to see the road to a pickup they had not yet accepted. It took
them off the app, away from the chat, the queue and the ride.

### 4. The fabricated arrival time

`src/app/map/page.tsx` gave every vehicle card a hardcoded `"2 min"` /
`"3 min"`. A number that was never measured, next to a real fare and a real
route. It could not be made real before a driver is assigned:
`operators.currentLocation` is only written when a driver **toggles their
shift**, so it is stale and unusable for a "nearest driver" estimate.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| How the road is drawn | New geometry goes into the source that is already there | The road moves; it never blinks |
| The leg's colour | Changed with `setPaintProperty` | A change of colour is the signal that the plan changed, and it must not take the road off the map |
| After a theme change | The road is put back on `styledata` | Otherwise the map shows no road for fifteen seconds |
| The ETA's source | The duration the router already returns | No extra request, and it is the road rather than a guess |
| The ETA's wording | Always "about" | The public router has no live traffic, so this is the time the road takes, not a promise about the traffic on it |
| Where the ETA appears | The live ride, and every open request in the driver's queue | The rider wants to know when the driver arrives; the driver is choosing between requests |
| How the queue is measured | The router's table service — one request for the whole queue | One request per request would be a dozen requests a minute to a free public service |
| The Navigate button | Replaced by the road to the pickup, drawn on the driver's own map | The same intent, in-app, with a live ETA |
| The fabricated "2 min" / "3 min" | Removed | It cannot be made real before a driver is assigned, so it comes off |
| The rider's map | Follows the driver while the ride is live, until the rider drags it | The road is drawn from the driver's position, so a map that does not follow them shows a road they cannot see |

---

## Architecture

### 1. The drawing — `src/lib/mapRoute.ts`

| Function | What it does |
|---|---|
| `ensureRouteLayers(map, phase)` | Adds the source and both layers **once** |
| `updateRouteGeometry(map, geometry, phase)` | `source.setData(...)` and `setPaintProperty(...)` |
| `applyRoutePhase(map, phase)` | Recolours the road for the leg it is on |
| `clearRouteLine(map)` | Blanks the source's data — the road goes, the layers stay |
| `removeRouteLayers(map)` | The teardown, when the map itself is going away |

### 2. The hook — `src/lib/useRouteLine.ts`

* The layers are never removed during a ride.
* A `styledata` listener puts the road back after a theme change.
* **The target is compared by value, not by identity.** The ride is a fresh
  object every time the server sends it — several times a minute while the
  vehicle's position is pushed — and a target compared by identity would be a
  different target every time, so the road would be fetched again and again.
  The measured count went from **140 requests in 45 seconds to 2**.
* It returns the route, so the caller can show the time.

### 3. The ETA — `src/lib/mapClient.ts`, `src/lib/format.ts`

```ts
export async function getRoute(start, end) {
  // { distanceMeters, durationSeconds, geometry, measuredAt }
}

export async function getRouteDurations(origin, destinations) {
  // The router's table service: a whole matrix in one request.
}
```

`formatEta(seconds)` → *"less than a minute"*, *"about 4 min"*, *"about 1 h 5 min"*.
`formatDistance(meters)` → *"140 m"* below a kilometre, *"18.1 km"* above it.

### 4. The panels — `src/app/operator/map/`

| File | Change |
|---|---|
| `OperatorPanels.tsx` | **new** — the queue, the detail sheet, the current-ride panel and the chat are one component, because they are one decision |
| `RideDetailSheet.tsx` | The Navigate button goes; the raw coordinates go; the ETA and *"The road to the pickup is drawn on your map"* take their place |
| `RideQueueSheet.tsx` | The ETA on every open request |
| `CurrentRidePanel.tsx` | The ETA to the pickup, or to the destination |
| `useQueueEtas.ts` | **new** — the queue's times, one request for the whole queue |
| `useQueueMarkers.ts` | **new** — the pins for the requests in the queue |
| `page.tsx` | `handleNavigate` is deleted; the road to the selected request is drawn instead |

### 5. Two maps, one hook — `src/lib/useMapInstance.ts`

The driver map had its own copy of the whole map-creation code. It now uses
the rider's hook, moved to `src/lib/`, so the two cannot disagree.

**And a bug it uncovered:** the teardown effect depended on `onMapReady`, and
the driver passed an inline arrow — so the callback was a new function on every
render, and the effect ran on every render: **the map was taken down and built
again each time.** The route hook always found an empty map. The callback is
now read through a ref, so it cannot cause that.

The map is also built **before** anything draws on it, on both maps.

---

## Work Breakdown

### Wave 1 — The road stops strobing

| # | Task | File |
|---|---|---|
| 1.1 | The layers are added once and updated in place | `src/lib/mapRoute.ts` |
| 1.2 | The road is put back after a theme change | `src/lib/useRouteLine.ts` |
| 1.3 | The target is compared by value | `src/lib/useRouteLine.ts` |

### Wave 2 — The ETA

| # | Task | File |
|---|---|---|
| 2.1 | The router's duration and distance are read | `src/lib/mapClient.ts` |
| 2.2 | The queue's times, one request for the whole queue | `src/lib/mapClient.ts`, `src/app/operator/map/useQueueEtas.ts` |
| 2.3 | How a time is said | `src/lib/format.ts` |
| 2.4 | The ETA on the rider's panel and the driver's panel | `src/app/map/RideProgressPanel.tsx`, `src/app/operator/map/CurrentRidePanel.tsx` |
| 2.5 | The fabricated "2 min" / "3 min" goes | `src/app/map/VehiclePicker.tsx` |

### Wave 3 — The driver's panels

| # | Task | File |
|---|---|---|
| 3.1 | The Navigate button and the Google Maps redirect go | `src/app/operator/map/RideDetailSheet.tsx`, `src/app/operator/map/page.tsx` |
| 3.2 | The road to the selected request is drawn on the driver's map | `src/app/operator/map/page.tsx` |
| 3.3 | The panels are one component | `src/app/operator/map/OperatorPanels.tsx` |
| 3.4 | One map hook for both maps | `src/lib/useMapInstance.ts` |

### Wave 4 — The rider's live map, verification, and the log

| # | Task | File |
|---|---|---|
| 4.1 | The map follows the driver, until the rider drags it | `src/app/map/useRideLocation.ts` |
| 4.2 | The tests | `tests/mapRoute.test.ts`, `tests/eta.test.ts`, `tests/operatorPanels.test.ts` |
| 4.3 | This plan and the log | `docs/`, `FIXOCT40.md` |

---

## Test Plan

| # | Assertion |
|---|---|
| T1 | The road is updated in place, never taken off and put back |
| T2 | Clearing the road blanks it without taking the layers off |
| T3 | The leg's colour changes without the road being taken off |
| T4 | The road is put back after a theme change takes the style with it |
| T5 | The road is not fetched again every time the server sends the ride |
| T6 | The rider's map follows the driver while the ride is live |
| T7 | A short road is about a minute |
| T8 | A road of a few minutes is about that many minutes |
| T9 | A long road is about an hour |
| T10 | A road that has not been measured says nothing |
| T11 | A distance below a kilometre is in metres |
| T12 | Nothing sends the driver out to Google Maps |
| T13 | The Navigate button is gone from the detail sheet |
| T14 | The road to the request being looked at is drawn on the driver's map |
| T15 | The time the road takes is on the driver's panels |
| T16 | The queue is measured with one request for the whole queue |
| T17 | The panels are one component, and the page is about the map |
| T18 | Both maps are built by one hook |
| T19 | The driver's map is built before anything draws on it |
| T20 | A map that has been removed cannot be drawn on |
| T21 | A map that is alive can be drawn on |
| T22 | No map at all cannot be drawn on |
| T23 | The road is not cleared on the way out |
| T24 | Every call into the map is behind the guard |

---

## Verification

```bash
npm run typecheck        # tsc --noEmit
npm run check            # ultracite check
npm test                 # vitest run
npm run build            # next build
npm run mobile:build     # next build && cap sync
```

**Before:** `tsc` 0 errors · `ultracite check` 0 errors · 255 tests passing.
**After:** `tsc` 0 errors · `ultracite check` 0 errors · **281** tests passing ·
`next build` OK.

### In a browser

Driven with Playwright against the dev server, as a real driver and a real
rider. The road was sampled every 500 ms for half a minute and counted by
colour.

| Check | Result |
|---|---|
| The driver's queue | *"Juan dela Cruz · standard · Cash · **about 2 min** · ₱42"* — a measured time, on every open request |
| The driver's detail sheet | *"The road to the pickup is drawn on your map."* and **no Navigate button** |
| The road on the driver's map, 60 samples over 30 s | **0 frames without the road** — 249 road pixels in every frame |
| The road on the rider's map, 60 samples over 30 s | **0 frames without the road** |
| OSRM requests over the same period | **2** — the table for the queue and one route |
| The rider's button | Says **"Confirm"**; disabled while the driver is more than a street block away, enabled when they arrive |
| After Confirming | *"Ride in progress"* · *"Time to your destination — about 3 min"*, with the blue carrying leg drawn on the map |

---

## Risk

| Risk | Mitigation |
|---|---|
| The road is fetched again and again | The target is compared by value. Measured: 140 requests in 45 s became 2 |
| A theme change leaves the map with no road | The road is put back on `styledata` |
| The ETA is read as a promise about traffic | It is always "about", and the docstring says the public router has no live traffic |
| The router is hammered | One request for the whole queue, a minute apart, and only once the driver has moved a hundred metres |
| A request is measured and the driver stands on it | The time is zero, so no time is shown. A time that has not been measured is never shown |
| The map follows the rider away from where they want to look | Dragging the map stops the following |
| The driver's map is rebuilt on every render | The map callback is read through a ref, so it cannot cause that |
| Leaving the map crashes the page | Every call into the map is behind `canDrawOn`, and the road is not cleared on the way out. A removed map is not drawable, not fatal |
