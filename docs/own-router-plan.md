# Owning the Road Distance — Assessment and Plan

**Log ID:** `fixoct32`
**Created:** 2026-10-28 13:10 PST (Wednesday)
**Status:** ⬜ Awaiting approval — only the duplicated comment was removed
**Related log:** [`FIXOCT32.md`](../FIXOCT32.md) at the repository root
**Previous:** [`docs/highlighted-route-plan.md`](highlighted-route-plan.md) (`fixoct31`)

---

## The question

Should the road distance behind the fare stop coming from the public OSRM
demo server, and come from a router we own — which would mean implementing
Dijkstra ourselves?

**Short answer: the enabling refactor is worth doing now; the migration is not
yet.** And when it is, the right form of "Dijkstra" is a self-hosted OSRM, not
our own implementation. The measurements below are what make that answer
specific rather than a general opinion.

---

## What was measured

### The road network is small

Queried from Overpass for Antique province (`ISO3166-2 = PH-ANT`):

| | Count |
|---|---|
| Highway ways of every class | **6,982** |
| Ways a motorcycle could use (excludes footway, path, cycleway, steps) | **5,743** |
| Nodes, implied | roughly **20,000 – 25,000** |
| Edges, implied | roughly **15,000 – 20,000** |

A plain Dijkstra over 25,000 nodes in JavaScript, with typed arrays and a
binary heap, runs in **single-digit milliseconds**. It would fit inside a Convex
action's memory without difficulty — the graph as typed arrays is on the order
of **1–3 MB**.

**Antique is small enough that implementing Dijkstra is genuinely viable.**
That is worth saying plainly, because it is the opposite of what the general
advice on routing engines suggests, and it is the reason the question is
interesting at all.

### The public router is one dataset wearing three hats

The public demo server answers `/route/v1/driving/…`, `/route/v1/motorcycle/…`
and `/route/v1/bicycle/…` with HTTP 200. But the distances it returns are
**identical** across all three:

```
San Jose block           driving=0.10km  motorcycle=0.10km  bicycle=0.10km
San Jose -> Sibalom      driving=9.42km  motorcycle=9.42km  bicycle=9.42km
Sibalom -> east          driving=10.56km motorcycle=10.56km bicycle=10.56km
```

The demo server hosts **one dataset, built for the car profile**. Asking for
`motorcycle` changes the cost weights but not the set of edges a route may use,
so its "motorcycle" answer is a car's answer with different weights. A real
motorcycle dataset has to be built and served by an instance you own.

### The estimate that is being replaced

Three hundred real trips between the app's own landmarks:

```
real circuity:  min 0.852   max 3.979   median 1.218   mean 1.263
factor 1.300 (the old):  mean +6.2%   overcharges 212/300
factor 1.181 (the new):  mean −3.5%   overcharges 132/300
```

This is why the router is the source of truth at all: the quantity varies by a
factor of five across one town, and no single multiplier can capture it.

---

## The three options, assessed

### Option A — Implement Dijkstra ourselves, inside the Convex action

**Benefits**

- **No external dependency at all.** No third-party uptime in the path of a
  money figure, no rate limit, no upstream change moving our prices.
- **A motorcycle profile we define.** Service roads, track surfaces, left-hand
  traffic — rules OSRM's shared dataset cannot express for us.
- **Deterministic.** The same graph answers the same question for ever.
- **No server to pay for.** It runs inside the action we are already paying for.
- **Feasible here, specifically.** 25,000 nodes is not a large graph, and
  contraction hierarchies are unnecessary at that size.

**Costs**

- **Turn restrictions.** OSRM's hardest feature, and the one that matters most
  here: the Aklan River divides the province, and a bridge's turn restrictions
  decide whether a motorcycle can actually make the turn.
- **One-way restrictions, access tags, ferry routes, surface and speed
  classes** — all handled by OSRM, all yours to implement.
- **The data pipeline.** Extracting Antique from OSM, then a builder that turns
  the PBF into a graph, is the real project. It is weeks rather than days, and
  it has to be maintained as OSM changes.
- **Staleness.** The graph is a build artefact. Refreshing it means
  regenerating and redeploying, or serving it from somewhere — and if you serve
  it from somewhere, you are back to a service.

**Verdict: technically very viable, and I would not do it.** We would own a
routing engine to avoid the cost of a 2 GB server. The 25,000-node graph is
what makes it *tempting*; the turn restrictions are what makes it *wrong*.

### Option B — Self-host OSRM

This **is** Dijkstra, with contraction hierarchies, and it is the mature
implementation.

**Benefits**

- **Our own dataset and our own profile.** A dataset built for `motorcycle`
  gives a genuinely different set of edges, not just different weights.
- **No rate limit, no shared contention, no upstream surprise.**
- **Contraction hierarchies.** The real Dijkstra optimisation, which makes
  province- and country-scale graphs trivial.
- **Faster and reliable.** Same region, and a service with an SLA we control.
- **A traffic feed** is possible.

**Costs**

- **A server.** 2 GB of RAM handles Antique comfortably. There is a monthly
  bill, and it is a real one.
- **The data pipeline.** `osmium extract` for Antique, then `osrm-prepare` —
  the expensive step, minutes for a province and hours for the whole country.
- **Ops.** The router is now a service that can be down. Although the estimate
  fallback covers that, which is the same situation as today.
- **Refreshing.** A rebuild cycle when OSM changes.

**Verdict: this is the version of "move to Dijkstra" that pays.** It is the
same algorithm, a better dataset, and a better profile.

### Option C — Stay on the public OSRM

**Benefits**

- No ops, no cost. The cache means each distinct pickup/dropoff pair is
  measured **once** and remembered for thirty days, so the dependency is
  touched far less than a request count suggests.
- One car dataset for every profile, which is a limitation, but for a
  motorcycle service in a small town where the roads are shared with cars, the
  difference is likely small.

**Costs**

- A shared third-party service in the path of a money figure.
- No profile of our own.
- No guarantee.

**Verdict: adequate for a project of this size, and adequate for longer than
it is usually given credit for, because of the cache.**

---

## The recommendation

**Do the enabling refactor now. Do not migrate yet.**

The valuable part of all of this is not the routing engine — it is that
**the app should not know where the distance came from.** Right now
`convex/lib/routing.ts:34` hard-codes `OSRM_BASE_URL`, so changing routers
means changing code.

Once the router is a seam, the migration becomes a configuration change and a
deployment, and the decision can be made when the facts justify it:

| When | Then |
|---|---|
| Now | Make the router pluggable. Stay on the public OSRM. |
| When there are real users, real volume, or a real uptime requirement | **Self-host OSRM** (Option B) with a `motorcycle` dataset. |
| Only if the network is a genuine, measured problem | Consider Option A, and only for Antique, with turn restrictions done properly. |

**One correction to my earlier advice.** I previously said the public demo
server only serves the `driving` profile. That was wrong — it serves the
`motorcycle` and `bicycle` paths too. What I should have said, and what the
measurement shows, is that it serves them **from one car dataset**, so the
profile is a set of weights rather than a set of roads. Self-hosting is what
buys a real profile.

---

## The integration plan

### Wave 1 — Make the router a seam

The change that pays whichever option is chosen later.

| # | Task | File |
|---|---|---|
| 1.1 | A `Router` interface: one method, `roadDistanceKm(from, to) → number \| null` | `convex/lib/router.ts` (new) |
| 1.2 | The OSRM implementation behind it, with the base URL and the profile read from the deployment's environment | `convex/lib/router.ts` |
| 1.3 | The environment module: `ROUTER_URL`, `ROUTER_PROFILE`, `ROUTER_TIMEOUT_MS`, with the current values as the defaults | `convex/env.ts` (new) |
| 1.4 | `convex/lib/routing.ts` keeps the geometry and the cache key, and delegates the measurement | `convex/lib/routing.ts` |
| 1.5 | The route drawing on the two maps uses the same base URL and profile as the fare, so the line and the price cannot come from different routers | `src/lib/mapClient.ts` |

**The deployment variables** — set with `npx convex env set`, exactly like
`SEED_KEY`:

```bash
npx convex env set ROUTER_URL "https://router.project-osrm.org/route/v1"
npx convex env set ROUTER_PROFILE "driving"
```

**The defaults must be the current behaviour.** With nothing set, the app uses
the public server and the `driving` profile, so deploying this changes nothing
until a variable is set.

### Wave 2 — The self-hosted path, documented and scripted

| # | Task | File |
|---|---|---|
| 2.1 | A script that extracts Antique from OSM and builds the dataset | `scripts/build-router.sh` (new) |
| 2.2 | The runbook: the server, the dataset build, the refresh cycle, the rollback | `docs/self-hosted-router.md` (new) |
| 2.3 | The `motorcycle` profile is used by default when the router is our own | `convex/lib/router.ts` |

**The build, in outline:**

```bash
# 1. the extract
osmium extract -b "region:PH-ANT" -o antique-latest.osm.pbf philippines-latest.osm.pbf

# 2. the dataset — this is the expensive step
osrm-routed --algorithm mld \
  -p /opt/osrm/profiles/motorcycle.lua antique-latest.osrm

# 3. serve it
osrm-routed --algorithm mld -p /opt/osrm/profiles/motorcycle.lua antique-latest.osrm
```

`--algorithm mld` uses multi-level Dijkstra, which is what makes a country-scale
graph fast. For Antique, `ch` (contraction hierarchies) is equally good and
builds faster.

**The refresh cycle.** The Philippine OSM extract is published daily; a
weekly rebuild is plenty for a service area, and the fare changes with it are
immaterial at a ₱12/kilometre meter.

### Wave 3 — Keeping the price and the line together

| # | Task | File |
|---|---|---|
| 3.1 | The map's route line is drawn by the same router the fare uses, with the same profile | `src/lib/mapClient.ts` |
| 3.2 | The fallback estimate stays, whatever the router is — a fare is never uncomputable | `convex/lib/routing.ts` |
| 3.3 | The cache stays, and its key is unchanged — the price a passenger was shown is the price they pay | `convex/routeCache.ts` |

### Wave 4 — Verification

| # | Assertion |
|---|---|
| T1 | With no router configured, the app behaves exactly as it does now. |
| T2 | The router's base URL and profile come from the deployment's environment. |
| T3 | A router that cannot be reached falls back to the estimate, and the fare is still computable. |
| T4 | The fare and the map's route line are drawn by the same router. |
| T5 | The router interface has one implementation behind it, and adding another touches nothing else. |

---

## Verification

```bash
npm run typecheck        # tsc --noEmit
npm run check            # ultracite check
npm test                 # vitest run
npm run build            # next build
```

**Baseline:** `tsc` 0 errors · `ultracite check` 0 errors · 151 tests passing ·
`next build` OK.

---

## Risk

| Risk | Mitigation |
|---|---|
| The refactor changes the fare | The defaults are the current behaviour, and the estimate fallback is untouched. The existing eleven routing assertions cover the distance, the cache and the price stability. |
| A self-hosted router goes down | The estimate fallback stands in, exactly as it does for the public server today. |
| The graph goes stale | A weekly rebuild cycle in the runbook, and the fare at ₱12 a kilometre barely moves when a road is added. |
| The two maps and the fare use different routers | One configuration, read from one place, used by all three. |
| We own a routing engine we cannot maintain | The reason the recommendation is not Option A. |
| The public server is taken away | That is the day Option B earns its cost. The seam means it is a configuration change, not a rewrite. |
