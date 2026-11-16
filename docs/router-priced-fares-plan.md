# Router-Priced Fares — Implementation Plan

**Log ID:** `fixoct30`
**Created:** 2026-10-28 09:10 PST (Wednesday)
**Status:** ✅ Executed — all four waves complete
**Result:** `tsc` 0 errors · `ultracite check` 0 errors · 142 tests passing · `next build` OK
**Related log:** [`FIXOCT30.md`](../FIXOCT30.md) at the repository root
**Previous:** [`docs/terms-acceptance-plan.md`](terms-acceptance-plan.md) (`fixoct29`)

---

## Overview

The fare was charged on a straight-line distance scaled by a hardcoded factor.
That factor was wrong often enough to matter: measured over three hundred real
trips between the app's own landmarks in Antique, it **overcharged two trips in
every three**, by up to 25.8% on distance.

The fix is not a different multiplier. It is to charge the fare on the
**road** distance, measured by the same routing service that already draws the
route on the map, so the price and the route the passenger is shown always
agree.

The tariff changes with it:

| Vehicle | Base | Included | Per started km |
|---|---|---|---|
| Standard | ₱30 | 2 km | ₱12 |
| Priority | ₱45 | 2 km | ₱12 |

---

## The measurement that settled the question

Three hundred distinct pairs among the app's twenty-five landmarks, each
measured against OSRM:

```
real circuity factor:  min 0.852   max 3.979   median 1.218   mean 1.263
factor 1.300: mean signed +6.2%   worst 67.3%   overcharges 212/300
factor 1.181: mean signed −3.5%   worst 70.3%   overcharges 132/300
```

A single multiplier cannot do this job. The true ratio of road distance to
straight-line distance ranges over almost a fivefold span in one town, because
it depends on whether the road goes straight there or has to take a detour.
The old factor of 1.3 was not a small inaccuracy; it was a systematic
overcharge on 71% of trips.

Worse, the app was already drawing the *true* route on the map with OSRM
while pricing the *guess*. A passenger could watch a 10.3 km route on screen
and be quoted for 12.5 km.

---

## Dijkstra or greedy?

**Neither, for fares — and the reason is worth stating plainly.**

OSRM's core routing algorithm **is** Dijkstra over the OpenStreetMap road
graph, accelerated with contraction hierarchies. The project was already
running it, from `src/lib/mapClient.ts`, to draw the route. Its response
already contained `routes[0].distance` — the true road distance — which the
`OsrmResponse` interface discarded because it only declared `geometry`.

| | Dijkstra | Greedy |
|---|---|---|
| What it needs | A weighted graph of the road network | A graph too, but only local structure |
| Who has the graph here | OSRM does. The app has none. | — |
| Result | The exact shortest path over real roads | A locally-optimal path that can be worse. For one origin→destination, "greedy" is not even well defined — you would want A\* |
| Cost to build it here | Host an OSM extract, build contraction hierarchies, keep it current | Invent a graph; the result is worse than the straight-line estimate already in place |
| Verdict | **Delegate it — OSRM already is Dijkstra** | **Not applicable to fares** |

Implementing Dijkstra would be a large infrastructure project producing a
worse result than OSRM, which has live road data. Greedy over an invented
graph would be worse than what was there.

**Where the question does belong: driver matching.** Matching is currently
"first driver to tap *Accept* wins". There, **greedy nearest-available-driver**
is the right answer — O(n) over the available drivers, no graph, and what
every on-demand service does. Dijkstra only earns its keep for optimising
across many simultaneous requests at once, and that is a **bipartite matching
/ min-cost flow** problem, not Dijkstra. That is a separate piece of work.

---

## Problem Statement

| # | Problem | Detail |
|---|---|---|
| 1 | The fare is charged on a guess | `roadDistanceKm` = haversine × 1.3, a hardcoded factor |
| 2 | The guess overcharges | 212 of 300 measured trips, by up to 25.8% on distance |
| 3 | The price and the route disagree | The map draws the OSRM route; the price uses the estimate |
| 4 | The estimate is not a distance | The true circuity ranges from 0.85 to 3.98 in one town |
| 5 | A mutation cannot call the router | Convex: *"Mutations cannot call third-party APIs or use `fetch`"* |
| 6 | A query cannot either | Convex: *"Queries are pure reads, they cannot… call external APIs"* |
| 7 | The quote and the fare must agree | A passenger cannot be quoted one price and charged another |
| 8 | The router must not be called for every request | It has no service level, and the dropoff is one of twenty-five fixed landmarks |

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| The source of the distance | OSRM, asked server-side | It is already drawing the route; using it for the price is what makes them agree |
| Implementing it yourself | No | You would have to host an OSM extract and build contraction hierarchies, and still be worse than OSRM |
| The fallback | The straight-line estimate, recalibrated to 1.18 | A fare is a money figure and can never fail to be computable |
| Where the call lives | A Convex **action** | A mutation and a query cannot make a network call |
| The write | An internal mutation in its own module | Convex asks for the split, and the type inference needs it |
| The quote and the booking | Both read the same cached row | The price the passenger was shown is the price they pay |
| The cache | `routeDistances`, keyed by the rounded coordinates | The dropoff is one of twenty-five landmarks, so the pairs repeat |
| Caching stale answers | Refreshed after thirty days | Roads are built and closed, but not often |
| The tariff | ₱30 / ₱45 base, 2 km included, ₱12 per km | The brief |
| The "arrived" distance | Not a concern here | The router is asked for the distance, not for the path |

### Non-goals

* Replacing OSRM with a self-hosted instance. The public demo server is fine
  for a project of this size, and self-hosting is a deployment decision.
* A real dispatch algorithm. **Greedy** nearest-driver, as a separate piece of
  work.
* Traffic-aware pricing. The tariff is flat per kilometre.
* Turning the fallback into a per-road-class model. The router is the answer;
  the fallback is a safety net.

---

## Architecture

### 1. The distance — `convex/lib/routing.ts` (new)

| Function | Purpose |
|---|---|
| `haversineKm` | The straight-line distance, moved here from `fare.ts` |
| `estimateRoadKm` | The fallback, scaled by `ROAD_CIRCUITY_FACTOR` (1.18) |
| `fetchRoadDistanceKm` | The router, with a three-second timeout. Returns `null` when it cannot be reached |
| `routeCacheKey` | The cache key, four decimal places — about eleven metres |
| `coordinateValidator` | The shared argument validator |

### 2. The tariff — `convex/lib/fare.ts`

```ts
export const FARE_RATES: Record<VehicleType, FareRate> = {
  standard: { base: 30, includedKm: 2, perKm: 12 },
  priority: { base: 45, includedKm: 2, perKm: 12 },
};
```

`quoteFare` is now applied to a distance that is already known, rather than
measuring one itself. The measurement is the caller's job.

### 3. The cache — `convex/routeCache.ts` and `convex/routeDistances.ts`

Two modules, because a Convex function cannot reach for an internal function
of its own module without the types referring back on themselves.

| Function | Module | What it does |
|---|---|---|
| `get` | `routeCache` | The remembered distance, if it is still fresh |
| `put` | `routeCache` | Remembers a distance |
| `getOrFetch` | `routeDistances` | **The action.** Cache first; the router only when the answer is not known; the estimate when the router cannot be reached |

The cache is *never* overwritten with a fresh answer inside its lifetime, so
the distance behind a quote and the distance behind the booking are the same
number.

### 4. The schema — `routeDistances`

```ts
routeDistances: defineTable({
  distanceKm: v.number(),
  fetchedAt: v.number(),
  key: v.string(),
  source: v.union(v.literal("router"), v.literal("estimate")),
}).index("by_key", ["key"]),
```

### 5. The public surface — `convex/rides.ts`

| Function | Was | Now |
|---|---|---|
| `quoteFare` | `getFareQuote`, a query | An **action** — it measures the distance |
| `create` | A mutation | An **action** — it measures the distance, then writes |
| — | — | `assertAuthorized` (internal query) — the gate, run before the router is asked |

### 6. The write — `convex/rideBooking.ts`

`insert` (an internal mutation) takes the **distance** as an argument rather
than measuring it, because the measurement was made by the router and the fare
has to be charged on that exact number. The client never supplies it.

### 7. The client — `src/app/map/page.tsx`

`useQuery(api.rides.getFareQuote)` became `useAction(api.rides.quoteFare)`
plus an effect that fetches the price when the coordinates change, and
`useMutation(api.rides.create)` became `useAction(api.rides.create)`.

The *Book* button is still disabled until a price has arrived, so the
passenger never books a trip that has not been priced.

---

## Work Breakdown

### Wave 1 — The tariff and the fallback ✅

| # | Task | File |
|---|---|---|
| 1.1 | The new tariff, and the recalibrated fallback factor | `convex/lib/fare.ts`, `convex/lib/routing.ts` |
| 1.2 | The fallback price shown before the quote arrives | `src/app/map/page.tsx` |

### Wave 2 — The router-priced distance ✅

| # | Task | File |
|---|---|---|
| 2.1 | The geometry, the router call, the cache key | `convex/lib/routing.ts` |
| 2.2 | The cache table | `convex/schema.ts` |
| 2.3 | The cache and the measuring action | `convex/routeCache.ts`, `convex/routeDistances.ts` |
| 2.4 | The quote and the booking as actions; the write as an internal mutation | `convex/rides.ts`, `convex/rideBooking.ts` |
| 2.5 | The client fetches the price imperatively | `src/app/map/page.tsx` |
| 2.6 | The generated module list | `convex/_generated/api.d.ts` |

### Wave 3 — Verification ✅

| # | Task | File |
|---|---|---|
| 3.1 | The router is stubbed, so no test touches the network | `tests/setup.ts`, `vitest.config.ts` |
| 3.2 | The distance, the cache, the fallback and the price stability | `tests/convex/routing.test.ts` |
| 3.3 | The tariff and the booking, updated | `tests/convex/rides.test.ts`, `tests/convex/matching.test.ts` |
| 3.4 | The fare table in the README | `README.md` |

---

## Test Plan

| # | Assertion |
|---|---|
| T1 | The cache key is stable for a pair of places and different for another. |
| T2 | The estimate is finite and greater than zero. |
| T3 | The quote is charged on the distance the router reported. |
| T4 | The quote and the booking are charged on the same distance. |
| T5 | The router is asked once for a pair, not once for every fare. |
| T6 | The measured distance is remembered in the cache. |
| T7 | A router that cannot be reached falls back to the estimate. |
| T8 | A booking still goes through when the router is down. |
| T9 | The price does not move between the quote and the booking. |
| T10 | The booking refuses a passenger who does not own the profile. |
| T11 | The cached distance is readable through the internal query. |
| T12 | The tariff is ₱30 / ₱45 base, 2 km included, ₱12 per km. |

---

## Verification

```bash
npm run typecheck        # tsc --noEmit
npm run check            # ultracite check
npm test                 # vitest run
npm run build            # next build
```

**Before:** `tsc` 0 errors · `ultracite check` 0 errors · 131 tests passing.
**After:** `tsc` 0 errors · `ultracite check` 0 errors · **142** tests passing ·
`next build` OK.

### One thing the plan did not foresee

A Convex function that reaches for an internal function of *another* module
makes TypeScript's types refer back on themselves, because the api map has to
expand every module to type the `internal` object. The error reads:

> `'quoteFare' implicitly has type 'any' because it does not have a type
> annotation and is referenced directly or indirectly in its own initializer.`

The fix is to give the handler an **explicit return type**. With the type
written out, the exported function's type no longer depends on the api map, and
the cycle is broken. The same split — public actions here, internal mutations
in `convex/rideBooking.ts` — is what Convex asks for anyway.

---

## Risk

| Risk | Mitigation |
|---|---|
| The public OSRM demo server is down or slow | A three-second timeout, and the estimate as the fallback. A fare is never uncomputable. |
| The public OSRM demo server is rate limited | The cache. The dropoff is one of twenty-five fixed landmarks, so the pairs repeat. |
| The distance a passenger is quoted could differ from the one they are charged | The quote and the booking read the same cached row, and the cache is never overwritten inside its lifetime. |
| A caller burns the router's budget | `assertAuthorized` runs before the router is asked. |
| The fallback is still an estimate | It only ever stands in for a router that could not be reached, and it is recalibrated rather than guessed. |
| The two modules that split one concern are confusing | They are named for what they do — `routeCache` remembers, `routeDistances` measures — and the reason is documented in each. |
