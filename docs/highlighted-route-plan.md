# Highlighted Route Lines — Implementation Plan

**Log ID:** `fixoct31`
**Created:** 2026-10-28 10:05 PST (Wednesday)
**Status:** ✅ Executed — all three waves complete
**Result:** `tsc` 0 errors · `ultracite check` 0 errors · 151 tests passing · `next build` OK · `npm run mobile:build` OK
**Related log:** [`FIXOCT31.md`](../FIXOCT31.md) at the repository root
**Previous:** [`docs/router-priced-fares-plan.md`](router-priced-fares-plan.md) (`fixoct30`)

---

## Overview

The operator's map draws a road, but it is the wrong road, and it is drawn
plainly.

`usePassengerMarker` routes from the driver's live position to the
**passenger's live position**, in every phase of the ride. That is wrong twice
over:

- **While collecting** (`accepted`) the operator needs the road from where they
  are to the **pickup point**. The road to where the passenger is standing
  right now is a different road, and the passenger may be walking toward the
  pickup.
- **While carrying** (`inProgress`) the operator needs the road from where
  they are to the **dropoff**. The road "driver → passenger" is a road to the
  passenger's own position, which is where the driver already is.

So the operator has **no route to the destination at all**, and the one they
do have during the pickup points at the wrong place. Neither map marks the
pickup or the dropoff, so there is nothing on screen saying where they are
going.

The line itself is a 4px blue line at 0.7 opacity with no casing. It reads as
a hairline, not as *the* route.

This plan makes the route **highlighted**, **phase-aware**, and the same on
both screens, so the operator and the passenger are looking at the same road.

---

## Problem Statement

| # | Problem | Detail |
|---|---|---|
| 1 | The operator's route points at the wrong place while collecting | It routes to the passenger's live position, not to the pickup point |
| 2 | There is no route to the destination | During `inProgress` the route is driver → passenger, which is a road to where the driver already is |
| 3 | The line is not highlighted | A 4px line at 0.7 opacity, with no casing, reads as a hairline |
| 4 | The pickup and the dropoff are not on the map | Nothing marks where the ride is going |
| 5 | The two screens draw the road differently | The passenger's map and the operator's map have their own copies of the drawing code, and they have already drifted |
| 6 | The route is redrawn on every passenger position update | Twelve router requests a minute, while the ride is live |

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Where the road is drawn | A shared hook, `src/lib/useRouteLine.ts` | The two screens must not be able to drift again |
| The two legs | `toPickup` and `toDestination`, chosen by the ride's status | One rule, used by both maps |
| The origin | The driver's live position, in both legs | The vehicle is the origin of both roads, and it is the same on both screens |
| The colour | Emerald while collecting, sky while carrying | A colour change is an unmistakable signal that the plan has changed |
| The highlight | A dark casing under a bright line | The casing is what makes a route read as *the* route rather than a line on a map |
| The pickup and dropoff pins | On both maps | The destination should be visible before the trip starts |
| The redraw cadence | Fifteen seconds, and only when the driver has moved forty metres | A route request every five seconds is a lot for a free public router |
| The operator's passenger pin | Kept | It is still useful — it is where the passenger actually is |

---

## Architecture

### 1. The route layer — `src/lib/mapRoute.ts` (new)

```ts
export type RoutePhase = "toPickup" | "toDestination";

export interface RouteLeg {
  origin: { latitude: number; longitude: number } | null;
  phase: RoutePhase;
  target: { latitude: number; longitude: number } | null;
}

/** The leg a ride in a given status is on. */
export function routeLegForRide(ride, driverLocation): RouteLeg;

/** Draws the road: a dark casing under a bright line. */
export function drawHighlightedRoute(map, geometry, phase): void;

/** Takes the road off the map. */
export function clearRouteLine(map): void;
```

The casing is what does the work. A line on its own is hard to follow against
a map; a wide dark line under a narrow bright one reads the way a
navigation app's route does.

### 2. The hook — `src/lib/useRouteLine.ts` (new)

Owns the fetch and the cadence:

- **Immediately** when the target changes or the leg changes.
- **Every fifteen seconds** after that, and only if the driver has moved more
  than forty metres — so a stationary driver does not keep asking the router
  the same question.

### 3. The operator's map — `src/app/operator/map/`

`usePassengerMarker` keeps the passenger's pin and loses the road. The
pickup and the dropoff get their own pins. The road is drawn by the shared
hook.

### 4. The passenger's map — `src/app/map/useRideLocation.ts`

The road moves to the shared hook too, so the two screens draw the same road
in the same colours.

---

## Work Breakdown

### Wave 1 — The shared layer ✅

| # | Task | File |
|---|---|---|
| 1.1 | The route layer: the leg, the highlighted drawing, the clearing | `src/lib/mapRoute.ts` (new) |
| 1.2 | The hook: the fetch and the cadence | `src/lib/useRouteLine.ts` (new) |

### Wave 2 — The two maps ✅

| # | Task | File |
|---|---|---|
| 2.1 | The operator's map: the leg, the highlighted road, the pickup and dropoff pins | `src/app/operator/map/page.tsx`, `src/app/operator/map/usePassengerMarker.ts` |
| 2.2 | The passenger's map: the same highlighted road | `src/app/map/useRideLocation.ts` |

### Wave 3 — Verification, repair and release ✅

| # | Task | File |
|---|---|---|
| 3.1 | The route layer is unit tested | `tests/mapRoute.test.ts` (new) |
| 3.2 | The verification run | — |
| 3.3 | The duplicate requests on the deployment are repaired | `convex/repair.ts` |
| 3.4 | The Android app is rebuilt and synced | `npm run mobile:build` |

---

## Test Plan

| # | Assertion |
|---|---|
| T1 | A ride that is collecting routes to the pickup. |
| T2 | A ride that is under way routes to the dropoff. |
| T3 | The origin is the driver's position in both legs. |
| T4 | A ride that is not live has no leg. |
| T5 | The collecting leg and the carrying leg are drawn in different colours. |
| T6 | The road is drawn as a casing under a line. |
| T7 | Clearing the road removes both. |
| T8 | The two maps use the same leg rule, so they cannot drift. |

---

## Verification

```bash
npm run typecheck        # tsc --noEmit
npm run check            # ultracite check
npm test                 # vitest run
npm run build            # next build
```

**Before:** `tsc` 0 errors · `ultracite check` 0 errors · 142 tests passing.
**After:** `tsc` 0 errors · `ultracite check` 0 errors · **151** tests passing ·
`next build` OK.

### What the repair found on the deployment

The deployment was inspected before anything was changed:

```
byStatus: { cancelled: 5, completed: 7, pending: 2 }
livePerPassenger: { "Louie Igop": 2 }
```

The code was deployed with `npx convex dev --once`, which also activated the
stale-request expiry cron added in `fixoct27`. That cron cancelled both of the
passenger's open requests before the repair mutation had anything left to do —
the repair returned zeros because there was nothing left to cancel. The deployment
now has **no live rides**.

### On a device

1. The driver takes a booking → the map draws an **emerald** road from the
   driver's position to the **pickup pin**, and the passenger's pin is on the
   map.
2. The driver presses *Picked Up* → the road turns **sky** and now runs to the
   **dropoff pin**.
3. The passenger's map shows the same road in the same colour.

---

## Risk

| Risk | Mitigation |
|---|---|
| The router is asked too often | A fifteen-second cadence, and only when the driver has moved forty metres. |
| The route lags behind a moving driver | Forty metres is about the length of a city block; the road is a guide, not a turn-by-turn instruction. |
| The two screens drift apart again | One hook and one leg rule, used by both. |
| A stale route is left on the map | The leg is cleared whenever the ride is not live. |
| The two screens show the road at slightly different moments | The colour and the rule are shared; only the draw timing can differ by a second. |
