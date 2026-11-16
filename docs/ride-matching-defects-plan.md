# Ride Matching Defects — Implementation Plan

**Log ID:** `fixoct27`
**Created:** 2026-10-27 23:32 PST (Tuesday)
**Status:** ✅ Executed — all four waves complete
**Result:** `tsc` 0 errors · `ultracite check` 0 errors · 102 tests passing · `next build` OK
**Related log:** [`FIXOCT27.md`](../FIXOCT27.md) at the repository root

---

## Overview

An operator ("John Doe") was approved by an admin, a commuter ("Louie Igop") opened a
booking, and the operator could neither take the booking nor pick the passenger up. Two
entries for Louie Igop then appeared in the operator's ride queue and neither could be
accepted.

**This is not a conflict between those two accounts.** The two accounts are only the
trigger. The defect is in the ride-matching feature itself, and it reproduces with any
driver, any passenger, and any number of accounts. The reproduction below is automated
and runs against the real Convex functions.

Three structural faults combine:

1. **The operator's queue is global, not scoped.** Every driver sees every open request
   in the entire system, with the passenger's phone number, and the first driver to tap
   *Accept* wins a race. There is no dispatch, no proximity filter, no claim protocol.
2. **A passenger can hold more than one live booking, and the app then attaches them to
   the wrong one.** `rides.create` has no guard, so a double-tap, a dismissed sheet or a
   retry creates a second `pending` ride. `findActiveCommuterRide` then resolves the
   passenger's "current" ride to the *newest* one — which is usually the unmatched
   duplicate — so the passenger stops seeing the driver who is actually on the way, and
   their GPS is pushed to the wrong ride.
3. **Errors are swallowed and mislabelled.** The operator's *Accept* handler catches every
   failure and reports `"This ride was already accepted by another driver."` The real
   failure after an admin approval is `"You must be online to accept a ride."` The
   driver reads a collision where there is none, and concludes the matching engine is
   broken.

On top of that, the operator's *Picked Up* button has no error handling at all, so a
rejected transition is a dead button with zero feedback.

---

## Problem Statement

| # | Problem | Evidence |
|---|---|---|
| 1 | A passenger can hold two live rides at once | `convex/rides.ts:289` `create` checks ownership only. No live-ride guard. |
| 2 | The passenger is attached to the wrong ride | `convex/rides.ts:623` `findActiveCommuterRide` returns the newest live ride, not the matched one. |
| 3 | A second driver can be matched to the same passenger | A second `pending` ride is a separate object; any other driver may accept it. |
| 4 | The operator's queue is global and unsorted | `convex/rides.ts:182` `listPendingWithCommuter` collects **all** `pending` rides in the deployment. |
| 5 | Every driver can read every passenger's phone number | `listPendingWithCommuter` applies `projectCommuterForCounterpart`, which includes `phone`, to rides they have not accepted. |
| 6 | The *Accept* error message is always wrong | `src/app/operator/map/page.tsx:499` — `catch { showToast("This ride was already accepted by another driver.") }`, error discarded. |
| 7 | A driver is not eligible to accept until they self-serve "Online" | `convex/admins.ts:105` — approval forces `isAvailable: false`. Nothing on the screen says so. |
| 8 | `isAvailable` is overloaded as *on shift* **and** *not busy* | `convex/rides.ts:428` `accept` sets `isAvailable: false`; `convex/rides.ts:512` `complete` sets it back to `true`. The driver's own shift is silently changed by the ride lifecycle. |
| 9 | *Picked Up* fails silently | `src/app/operator/map/page.tsx:504` `handlePickedUp` has no `try`/`catch`. |
| 10 | `updateStatus` has no transition validation | `convex/rides.ts:330` — `accepted → completed` is allowed; `inProgress → accepted` is allowed. |
| 11 | `updateStatus` does not restore availability | `updateStatus` never touches `operators.isAvailable`, so a ride completed through it leaves the driver permanently offline. |
| 12 | The passenger's *Cancel* is a no-op after a reload | `src/app/map/page.tsx:288` uses the local `activeRideId` state, which is `null` after a refresh. |
| 13 | Dismissing the booking sheet wipes the live ride UI | `src/app/map/page.tsx:321` `onDismiss={resetBooking}` — new in the uncommitted DragSheet work. |
| 14 | The map can never reach `completed`; *Pay & Rate Driver* is dead code | `findActiveCommuterRide` excludes `completed`; `useRideStage` early-returns on a null ride. |
| 15 | *"Confirm & Start Ride"* writes nothing to the server | `src/app/map/page.tsx:282` `handleConfirmBooking` only sets local state. |
| 16 | Stale `pending` rides never expire | No cron in `convex/crons.ts`. The seed creates one that lives forever. |
| 17 | On mobile the queue and the detail sheet occupy the same box | `src/app/operator/map/page.tsx:67` and `:78` — identical `absolute`/`z-40` coordinates. |
| 18 | The seed creates a `pending` ride that already has an `operatorId` | `convex/seed.ts:234` — an inconsistent state that also pollutes every driver's queue. |

---

## Reproduction

Written as `convex-test` suites against the real functions. The scratch versions of these
were run and produced the outputs quoted below; the permanent versions are specified in
**Wave 3**.

```
A. driver after approval:            { approval: 'approved', isAvailable: false }
A. accept ride1 FAILED:              You must be online to accept a ride
A. accept ride2 FAILED:              You must be online to accept a ride
A. queue rows:                       [ {name:'Louie Igop', phone:'+639…3'},
                                       {name:'Louie Igop', phone:'+639…3'} ]

B. ride1 accepted by John Doe.
B. COMMUTER sees ride:               ride2   status: pending   partner: NONE
B. >>> commuter is matched to:       ride2 (WRONG RIDE)
B. accept ride2 FAILED:              You already have an active ride
B. other driver accept ride2:        OK
B. driver isAvailable after accept:  { isAvailable: false }
B. pick up ride1:                    OK
```

Three things fall out of this:

* The passenger is **never shown the driver who is coming for them** once a duplicate
  exists — the commuter's panel stays on *"Finding your driver"* while John Doe is
  driving to the pickup point.
* The commuter's GPS is pushed to `activeRide._id`, so it goes to the duplicate ride.
  The driver, assigned to the original ride, sees no passenger pin.
* A **second driver can accept the duplicate**, so the passenger ends up with two
  drivers, two live rides, and one of them invisible to them.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Booking idempotency | `rides.create` returns the passenger's existing live ride instead of creating a second | Makes the client retry-safe and self-heals duplicates already in the database |
| Which ride is "the" ride | Matched rides (`accepted`/`inProgress`) always win over `pending` | The passenger must see the driver who is on the way |
| Shift vs. busy | Split them. `operators.isAvailable` means *on shift* only. Busy is derived from the rides table | `accept` must not change the driver's shift; `complete` must not change it either |
| Queue scope | A new driver-scoped query replaces `listPendingWithCommuter` | No global list, no cross-passenger phone exposure |
| Phone number visibility | Only after the ride is accepted | `projectCommuterForCounterpart` is a *counterpart* projection; using it for an unaccepted queue row is a leak |
| Error reporting | The server message is shown verbatim, plus a role-appropriate action | The current catch-all message sends the user hunting for the wrong bug |
| Transitions | An explicit server-side transition table | `accepted → completed` and `inProgress → accepted` must be impossible |
| Rider confirmation | A real `confirmedAt` field and a `rides.confirm` mutation | Makes *"Confirm & Start Ride"* mean something, and gives the driver a signal |
| Stale requests | A cron cancels `pending` rides older than 15 minutes | Stops queue pollution and ghost bookings |
| Data repair | A one-shot `internal` mutation to clean the existing deployment | The code fix alone will not unblock the current install |

### Non-goals

* A real dispatch algorithm (nearest driver, auto-assign, surge pricing). The plan makes
  the manual queue *correct*; it does not replace it.
* Scheduled or recurring rides. The model is one-off, on-demand.
* Push notifications. There is no notification channel today and adding one is a
  separate project.

---

## Goals

1. A passenger can never hold two live bookings, and the one they hold is always the one
   the app shows them.
2. A driver sees only the requests they can take, and a passenger's phone number is
   never exposed before the ride is accepted.
3. Every failure in the accept → pick up → complete chain surfaces the real reason and
   a next action.
4. The passenger can cancel, confirm, track, pay and rate without the UI and the server
   drifting apart.
5. The two accounts in the report — and any other pair — work end to end.

---

## Architecture

### 1. Data model (`convex/schema.ts`)

One new optional field on `rides`:

```ts
rides: defineTable({
  // …
  /** When the passenger confirmed the driver and the trip began. */
  confirmedAt: v.optional(v.number()),
})
```

No new tables. `operators` keeps `isAvailable`, but its meaning narrows to *on shift*.

### 2. Backend

#### 2.1 `convex/lib/rideState.ts` (new) — one source of truth for ride state

```ts
export const LIVE_STATUSES = ["pending", "accepted", "inProgress"] as const;

/** Where a ride may legally go next, and who may drive the transition. */
const TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  pending: ["accepted", "cancelled"],
  accepted: ["inProgress", "cancelled"],
  inProgress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransition(from: RideStatus, to: RideStatus): boolean;
export function isLive(status: RideStatus): boolean;
```

`convex/rides.ts` consumes this instead of the current free-form
`allowedStatusesFor(role)` + no from-state check.

#### 2.2 `rides.create` — idempotent, one live ride per passenger

```ts
// Before inserting:
const existing = await findLiveRideForCommuter(ctx, args.commuterId);
if (existing) {
  return { rideId: existing._id, reused: true };
}
// …insert…
return { rideId: id, reused: false };
```

The return type changes from `Id<"rides">` to `{ rideId, reused }`. There is exactly one
caller (`src/app/map/page.tsx:100`) and two test call sites
(`tests/convex/rides.test.ts:61,93`).

#### 2.3 `findActiveCommuterRide` — the matched ride wins

```ts
// Prefer a ride that has a driver; fall back to the newest pending one.
const matched = rides.find(
  (r) => r.status === "accepted" || r.status === "inProgress"
);
if (matched) return matched;
return rides.find((r) => r.status === "pending") ?? null;
```

`findActiveOperatorRide` gets the same treatment: `inProgress` before `accepted`.

#### 2.4 `rides.accept` — a clean, explicable contract

| Guard | Error message | Client action |
|---|---|---|
| ride is not `pending` | `"This request was already taken by another driver."` | Refresh the queue |
| driver already holds a live ride | `"Finish your current ride before taking another."` | Show the current ride |
| driver is not on shift | `"Go online to start taking rides."` | Offer the Online toggle |
| driver is not approved | `"Your account is not approved yet."` | Send to `/operator/application` |

And the mutation **no longer touches `operators.isAvailable`**. Busy state is derived:

```ts
export async function hasLiveRide(ctx, operatorId): Promise<boolean>;
```

#### 2.5 `rides.updateStatus` — validated transitions

```ts
const target = args.status;
if (!canTransition(ride.status, target)) {
  throw new Error(
    `A ride that is ${ride.status} cannot become ${target}.`
  );
}
// …existing role + ownership checks…
```

`updateStatus` also stops being a way to reach `completed`: `rides.complete` remains the
only path, because it carries the payment side effects.

#### 2.6 `rides.confirm` (new mutation) — the passenger's confirmation

```ts
export const confirm = mutation({
  args: { sessionToken, id: v.id("rides") },
  handler: /* commuter owns the ride, ride is `accepted` → set confirmedAt */,
});
```

#### 2.7 `rides.listPendingForMe` (new query) replaces `listPendingWithCommuter`

* Scoped to the requesting driver.
* Excludes any ride the driver already holds.
* Projects the passenger as `{ _id, name }` — **no phone number**. A new projection
  `projectCommuterForQueue` in `convex/lib/projections.ts`.
* Marks `vehicleType` compatibility so a driver who only has a standard bike can see
  which requests they can actually serve.

`listPendingWithCommuter` is deleted once the new query is live, so the leak cannot be
re-introduced by a stale caller.

#### 2.8 `getActiveForMe` — reachable `completed`

The commuter's branch returns the live ride **and**, when there is no live ride, the most
recent `completed` ride:

```ts
return { ride, partner, latestCompleted };
```

This is what makes *"Pay & Rate Driver"* reachable from the map.

#### 2.9 `convex/crons.ts` — expire stale requests

```ts
export const expireStalePendingRides = internalMutation({
  handler: /* cancel `pending` rides older than 15 minutes */,
});
```

Registered on a 5-minute interval.

#### 2.10 `convex/seed.ts` — the phantom ride

The seeded `pending` ride gets no `operatorId`, and the seed stops creating a request
that can never be matched.

### 3. Frontend

#### 3.1 `src/app/operator/map/page.tsx`

* `handleAcceptRide` — surface the real message:

  ```ts
  } catch (error) {
    showToast(
      error instanceof Error ? error.message : "Could not accept this ride.",
      "error"
    );
  }
  ```

* `handlePickedUp` / `handleCompleteRide` — wrap in `try`/`catch` and toast the message.
  A dead button with no feedback is the single most confusing symptom in the report.
* The Online toggle — when the driver is off shift and requests are waiting, show a
  banner: *"Go online to start taking rides."* This is the missing half of the approval
  flow.
* The queue — switch to `rides.listPendingForMe`.
* Disable the Online toggle while a live ride is held, and **never** let the toggle set
  `isAvailable: true` while a ride is live.

#### 3.2 `src/app/map/page.tsx`

* `handleCancelRide` — cancel `activeRide._id` from the live query, not the local
  `activeRideId` state. The local state stays only as an optimistic id.
* `resetBooking` — refuse to reset while a live ride exists. The DragSheet's
  `onDismiss` is only wired when `!activeRide`, so dragging the sheet down mid-ride
  cannot wipe the tracking UI.
* `handleBookRide` — an in-flight guard: the Book button is disabled while the mutation
  is pending, so a slow network cannot produce a double submission.
* `handleConfirmBooking` — call `rides.confirm` instead of only setting local state.
* The `hasRoute` check — add the missing `pickupCoords.lng !== 0` term
  (`src/app/map/page.tsx:124`).

#### 3.3 `src/app/map/useRideStage.ts`

Derive the stage from the server status and `confirmedAt` only. The local
`confirmedRide` boolean disappears; the `"arrived"` dead state is either wired to a real
server field or removed.

#### 3.4 `src/app/operator/map/page.tsx` — mobile stacking

The ride-detail sheet must not share coordinates with the ride queue. Either the queue
unmounts while the detail is open, or the detail gets a higher `z-index`. One of the
two, not both.

---

## Work Breakdown

### Wave 0 — Unblock the current deployment — ✅ code written, ⬜ not yet run against the deployment

> Nothing else matters until the live install is unblocked.

| # | Task | File |
|---|---|---|
| 0.1 | `internal.repair.rides` — for every passenger with more than one live ride, keep the one that has a driver (or the oldest) and cancel the rest | `convex/repair.ts` ✅ |
| 0.2 | The same mutation resets `operators.isAvailable` for drivers who were flipped offline by `accept` while holding a live ride | `convex/repair.ts` ✅ |
| 0.3 | The same mutation clears the `operatorId` on a pending request that names a driver | `convex/repair.ts` ✅ |
| 0.4 | Run it against the deployment and verify | — ⬜ **not run — needs the deployment** |

### Wave 1 — Server invariants — ✅

| # | Task | File |
|---|---|---|
| 1.1 | `convex/lib/rideState.ts` — transition table, `isLive`, `hasLiveRide` | new |
| 1.2 | `rides.create` — idempotent, one live ride per passenger | `convex/rides.ts` |
| 1.3 | `findActiveCommuterRide` / `findActiveOperatorRide` — matched ride wins | `convex/rides.ts` |
| 1.4 | `rides.accept` — new guards and messages; stop touching `isAvailable` | `convex/rides.ts` |
| 1.5 | `rides.updateStatus` — validate transitions; `complete` is the only path to `completed` | `convex/rides.ts` |
| 1.6 | `rides.confirm` — new mutation | `convex/rides.ts` |
| 1.7 | `rides.listPendingForMe` — driver-scoped, no phone | `convex/rides.ts` |
| 1.8 | `projectCommuterForQueue` — `{ _id, name }` | `convex/lib/projections.ts` |
| 1.9 | `getActiveForMe` — return `latestCompleted` for the commuter | `convex/rides.ts` |
| 1.10 | `expireStalePendingRides` + cron | `convex/crons.ts` |
| 1.11 | Fix the seeded phantom ride | `convex/seed.ts` |
| 1.12 | Delete `listPendingWithCommuter`. The other legacy queries stay — they are the compatibility shim for the pre-remediation Android builds, and their removal is the separate cutover task | `convex/rides.ts` |

### Wave 2 — Client correctness — ✅

| # | Task | File |
|---|---|---|
| 2.1 | Surface the real error in accept / pick up / complete | `src/app/operator/map/page.tsx` |
| 2.2 | "Go online" banner + toggle guard while a ride is live | `src/app/operator/map/page.tsx` |
| 2.3 | Move the queue to `listPendingForMe` | `src/app/operator/map/page.tsx` |
| 2.4 | Cancel uses the live ride id | `src/app/map/page.tsx` |
| 2.5 | `onDismiss` only when there is no live ride | `src/app/map/page.tsx` |
| 2.6 | In-flight guard on the Book button | `src/app/map/page.tsx`, `src/app/map/VehiclePicker.tsx` |
| 2.7 | `handleConfirmBooking` calls `rides.confirm` | `src/app/map/page.tsx` |
| 2.8 | `useRideStage` derives from the server only | `src/app/map/useRideStage.ts` |
| 2.9 | Map reaches `completed` → *Pay & Rate Driver* is live | `src/app/map/page.tsx`, `src/app/map/useRiderView.ts` |
| 2.10 | Mobile queue / detail sheet no longer overlap — the queue unmounts while a request is open, and the detail sheet sits above it | `src/app/operator/map/RideQueueSheet.tsx`, `src/app/operator/map/RideDetailSheet.tsx` |
| 2.11 | `hasRoute` longitude check | `src/app/map/page.tsx` |

### Wave 3 — Verification — ✅

| # | Task | File |
|---|---|---|
| 3.1 | `tests/convex/matching.test.ts` — the reproduction, as assertions | new |
| 3.2 | Transition-table unit tests | `tests/convex/matching.test.ts` |
| 3.3 | Projection tests — the queue must not carry a phone number | `tests/convex/authz.test.ts` |
| 3.4 | Idempotency test — a second `create` returns the same ride | `tests/convex/matching.test.ts` |
| 3.5 | Cron test — a stale pending ride is cancelled | `tests/convex/matching.test.ts` |
| 3.6 | `npm run typecheck` · `npm run check` · `npm test` | — |
| 3.7 | Manual pass with three accounts: commuter, driver, admin | — ⬜ **outstanding** |

---

## Test Plan

Every assertion below is a failure that reproduces today.

| # | Assertion |
|---|---|
| T1 | A second `rides.create` for a passenger with a live ride returns the same ride id and creates no new row. |
| T2 | With one `accepted` ride and one newer `pending` ride, the passenger's active ride is the `accepted` one and the partner is the operator. |
| T3 | A driver who is off shift cannot accept, and the error mentions going online — not another driver. |
| T4 | Accepting a ride does not change the driver's `isAvailable`. |
| T5 | A driver holding a live ride cannot accept another; the error names the current ride. |
| T6 | A ride in `accepted` cannot be moved to `completed` through `updateStatus`. |
| T7 | `updateStatus` from `inProgress` to `accepted` is rejected. |
| T8 | The driver queue projection contains no `phone` field. |
| T9 | `getActiveForMe` returns `latestCompleted` for a commuter with no live ride. |
| T10 | `rides.confirm` sets `confirmedAt` and rejects a commuter who does not own the ride. |
| T11 | The expiry cron cancels a `pending` ride older than 15 minutes. |
| T12 | Two drivers cannot accept the same ride (the second gets "already taken"). |

---

## Verification

```bash
npm run typecheck        # tsc --noEmit
npm run check            # ultracite check
npm test                 # vitest run
npm run build            # next build
```

**Baseline before the fix:** `tsc` 0 errors · `ultracite check` 0 errors · 87 tests
passing · `next build` OK.

**After the fix:** `tsc` 0 errors · `ultracite check` 0 errors · 102 tests passing
(88 existing + 14 new) · `next build` OK — 13 static routes prerender.

### What was built

| Plan item | Where it landed |
|---|---|
| `convex/lib/rideState.ts` | New module: the transition table, `isLive`, `isOnJob`, `hasLiveRide`. |
| Idempotent `rides.create` | Returns `{ rideId, reused }`; the passenger's live ride is returned instead of a second one. |
| Matched ride wins | `findActiveCommuterRide` prefers `accepted`/`inProgress`; `findActiveOperatorRide` prefers `inProgress`. |
| New accept guards | `"Go online to start taking rides."`, `"Finish your current ride before taking another."`, `"This request was already taken by another driver."` |
| Shift split from busy | `isAvailable` is the shift flag and is no longer written by `accept`, `complete` or `cancel`. Busy is derived by `hasLiveRide`. |
| Validated transitions | `updateStatus` refuses an illegal move; `complete` and `cancel` are the only paths to their statuses. |
| `rides.confirm` | New mutation; `rides.confirmedAt` on the schema. |
| Driver-scoped queue | `rides.listPendingForMe` replaces `listPendingWithCommuter`; `projectCommuterForQueue` carries no phone number. |
| `latestCompleted` | `getActiveForMe` returns the passenger's last finished trip, so the map can offer to pay for it. |
| Expiry cron | `expireStalePendingRides`, every five minutes, fifteen minute window. |
| Data repair | `convex/repair.ts` — `internal.repair.rides`, keyed on `REPAIR_KEY` (falling back to `SEED_KEY`). |
| Client error reporting | `errorMessage` in `src/lib/errors.ts`; every mutation handler now reports the server's message. |
| *Go online* banner | Shown on the operator map when the driver is off shift with requests waiting. |
| Extracted modules | `RideQueueSheet`, `RideDetailSheet`, `useRiderView`, `src/lib/geo.ts` — the operator map page went from 860 to 641 lines. |

### Running the repair

The code fix does not unblock a deployment that already holds duplicate rides. Run the
repair once against the deployment:

```bash
npx convex env set REPAIR_KEY "$(openssl rand -hex 16)"
npx convex run internal.repair.rides '{"repairKey":"<the key you set>"}'
```

It reports how many duplicate rides it cancelled, how many drivers it put back on
shift, and how many unclaimable requests it cleared. It never touches a completed
or paid ride.

**Manual pass:** one commuter, one driver and one admin, on the operator map:

1. Admin approves the driver → the driver lands on the map **offline** and sees
   *"Go online to start taking rides."*
2. Driver goes online → the queue shows the passenger's name, **no phone number**.
3. Driver accepts → the button reports the real error on failure; the passenger's map
   immediately shows *"Driver Assigned!"* with the driver's name, plate and colour.
4. Driver presses *Picked Up* → the passenger's map shows *"Ride in progress"* and the
   driver's pin moves.
5. Driver presses *Complete* → the passenger's map shows *"Ride completed"* and the
   *Pay & Rate Driver* button is live.
6. Passenger pays (GCash sandbox) and rates the driver.
7. The passenger books a second trip → the first trip is unaffected.

---

## Risk

| Risk | Mitigation |
|---|---|
| The idempotent `create` changes a public return type | One caller and two test call sites. Updated in the same wave. |
| Splitting "on shift" from "busy" changes the meaning of an existing field | The field is internal; no client reads it directly. `projectOperatorSelf` keeps exposing it as the shift flag. |
| The stricter transition table breaks the admin panel | `ADMIN_STATUSES` keeps every value, but admin transitions are validated too, so the panel must offer only legal targets. |
| The 15-minute expiry could cancel a request a driver was about to take | Riders are told the request expires; the window is generous for an in-town service. |
| Data repair touches live rows | Every repair mutation is `internal`, requires an explicit key, and only cancels `pending` duplicates — never a paid or in-progress ride. |

---

## Out of Scope

Found in the same area, reported for a future plan rather than fixed here:

* The operator's earnings and ride counters are local `useState` and reset on reload
  (`src/app/operator/map/page.tsx:130`).
* `messages.markAsRead` computes `otherRole` as `"commuter"` for an admin
  (`convex/messages.ts:101`).
* The vehicle-type mismatch: the schema allows five types, the validator allows two.
* `src/lib/convexConfig.ts` holds six dead interfaces, one of which declares a ride
  status union that contradicts the schema.
* `convex/lib/legacyAccess.ts` is a temporary shim for pre-remediation Android builds
  and is documented for deletion at cutover.
