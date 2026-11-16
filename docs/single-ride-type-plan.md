# One Ride Type — Implementation Plan

**Log ID:** `fixoct41`
**Created:** 2026-11-03 13:10 PST (Tuesday)
**Status:** ✅ Executed
**Result:** `tsc` 0 errors · `ultracite check` 0 errors · 286 tests passing · `next build` OK · verified in a browser
**Related log:** [`FIXOCT41.md`](../FIXOCT41.md) at the repository root
**Previous:** [`FIXOCT40.md`](../FIXOCT40.md) (`fixoct40`)

---

## Overview

> *"Integrate only having one type of ride which is standard, remove the
> priority ride."*

There were two ride types — **Standard** at ₱30 and **Priority** at ₱45 — and
choosing between them was a step of its own in the booking. Now there is one
ride type, it is not a choice, and it is not a step.

Two things had to be true at once, and they pulled against each other:

1. **The app offers one ride type.**
2. **The Android builds already on phones keep working.** They cannot be
   changed — the web code inside an APK is frozen at build time — so the
   server still has to answer the calls they make.

---

## The decisions

| Decision | Choice | Why |
|---|---|---|
| The vehicle step | **Removed** | A screen that asks a rider to choose between one thing is a screen with no choice on it |
| Where the class and the fare went | Onto the payment step | The payment step already said what the trip costs; the class and the capacity join it there |
| The ride type as a parameter | **Removed from the client's call** | There is one ride type, so it is a fact of the system, not something the rider chooses |
| What the legacy fleet's "priority" means | **The ride that exists, at the fare it was quoted** | There is only one fare now, so the legacy card shows the right price and the booking works |
| The quote response | **Keeps a quote for the legacy ride type** | The old build reads it for a card it is about to stop offering — without it, its map screen throws |
| The schema | **Narrowed to one ride type** | The model should say what the app does |
| The rows that named another type | Rewritten by a repair, before the narrowing | A row that names a type the schema no longer allows is a row the server cannot read |
| The class, shown everywhere | **Removed where it is now constant** | "Standard" on every trip is noise |

---

## Architecture

### 1. The model — `convex/lib/fare.ts`

```ts
export type VehicleType = "standard";
export const VEHICLE_TYPE: VehicleType = "standard";

export const vehicleTypeValidator = v.union(
  v.literal("standard"),
  v.literal("priority")
);

export function vehicleTypeFor(_requested: string | undefined): VehicleType {
  return VEHICLE_TYPE;
}
```

The validator still accepts `"priority"` — that is the legacy window — and
`vehicleTypeFor` maps whatever was asked for onto the ride that exists.

`FARE_RATES` has one entry. `quoteFare` takes one ride type.

### 2. The quote — `convex/rides.ts`

The response keeps a quote for the legacy ride type, because the old build
reads `quote.priority.fare` **for a card it is about to stop offering** — and
without it, its map screen throws when it draws that card. It is the same
fare, because there is only one.

### 3. The booking — `convex/rides.ts`, `convex/rideBooking.ts`

`vehicleType` is optional on the booking. The client does not send it: there
is one ride type, so it is not a parameter. A legacy client that sends
`"priority"` is booked as the ride that exists, at the fare it was quoted.

### 4. The data — `convex/schema.ts`, `convex/repair.ts`

`rides.vehicleType` is narrowed to `v.optional(v.literal("standard"))`.

Narrowing it needed the rows first: a ride that named a type the schema no
longer allows is a ride the server cannot read. So the order was:

1. Deploy the code with the schema still wide.
2. Run `internal.repair.vehicleType` — it rewrote the one row that named
   Priority.
3. Narrow the schema and deploy.

### 5. The screens

| File | Change |
|---|---|
| `src/app/map/PaymentMethodPicker.tsx` | The class, the capacity and the fare are shown on it |
| `src/app/map/VehiclePicker.tsx` | **Deleted** |
| `src/app/map/page.tsx` | The vehicles array and the selected vehicle are gone; the booking no longer sends a ride type |
| `src/app/map/LocationStep.tsx` | "Choose a ride" → "Continue" |
| `src/app/map/rideStage.ts` | The `"vehicle"` step is gone |
| `src/app/operator/map/RideQueueSheet.tsx` | The vehicle chip is gone |
| `src/app/operator/map/RideDetailSheet.tsx` | The vehicle box is gone; the grid is two wide |
| `src/app/profile/page.tsx` | The class is gone from the history |
| `src/components/admin/AdminPanels.tsx` | The class is gone from the rows; the cancellations are one summary |
| `convex/profile.ts`, `convex/adminQueries.ts` | The rows do not carry a ride type |
| `src/lib/format.ts` | `VEHICLE_LABELS` and `vehicleLabel` are gone — nothing displays it any more |
| `src/app/operator/RideQueue.tsx`, `RideDetailsPanel.tsx` | **Deleted** — superseded by the sheets, and never imported |

---

## The bug the browser found

The ride type was not the only thing that was wrong.

While verifying the new flow, the fare came up blank — the payment step said
"₱—" because the quote never arrived. The reason was not the ride type: the
pickup could not be searched for.

**The geocoder answers with a bare list of places**, and the app read it as an
object with a `results` key:

```ts
const data = (await response.json()) as NominatimResponse;
return data.results ?? [];        // always []
```

`data.results` is always `undefined`, so **the search returned nothing at
all** — and the only way a rider could set a pickup was to use the device's
own position.

It has been broken since the place search was written.

---

## Work Breakdown

### Wave 1 — The model ✅

| # | Task | File |
|---|---|---|
| 1.1 | One ride type, one tariff | `convex/lib/fare.ts` |
| 1.2 | The booking takes no ride type; a legacy one is mapped | `convex/rides.ts`, `convex/rideBooking.ts` |
| 1.3 | The quote keeps the legacy ride type's price | `convex/rides.ts` |
| 1.4 | The rows are rewritten, then the schema narrowed | `convex/repair.ts`, `convex/schema.ts` |
| 1.5 | The seed rides the ride that exists | `convex/seed.ts` |

### Wave 2 — The screens ✅

| # | Task | File |
|---|---|---|
| 2.1 | The class and the fare move onto the payment step | `src/app/map/PaymentMethodPicker.tsx` |
| 2.2 | The vehicle step is gone | `src/app/map/VehiclePicker.tsx`, `src/app/map/page.tsx`, `src/app/map/rideStage.ts` |
| 2.3 | The class is gone from the panels that showed it constantly | `src/app/operator/map/*`, `src/app/profile/page.tsx`, `src/components/admin/AdminPanels.tsx`, `src/lib/format.ts` |
| 2.4 | The dead panels are gone | `src/app/operator/RideQueue.tsx`, `src/app/operator/RideDetailsPanel.tsx` |
| 2.5 | The help and the fare table say one ride type | `src/lib/help.ts`, `README.md` |

### Wave 3 — The place search, and the verification ✅

| # | Task | File |
|---|---|---|
| 3.1 | The geocoder's answer is read as the list it is | `src/lib/mapClient.ts` |
| 3.2 | The tests | `tests/placeSearch.test.ts`, `tests/convex/rides.test.ts`, `tests/rideStage.test.ts` |

---

## Test Plan

| # | Assertion |
|---|---|
| T1 | There is one ride type, and it has one tariff |
| T2 | A booking without a ride type is booked as the one that exists |
| T3 | A booking that asks for the old Priority ride is booked as the one that exists |
| T4 | The quote still carries the legacy ride type's price, and it is the same fare |
| T5 | The geocoder's answer is a list of places |
| T6 | An answer that is not a list is treated as no answers |
| T7 | An empty search asks the geocoder for nothing |
| T8 | Every step before the ride is created can be left — the payment step goes back to the locations |

---

## Verification

```bash
npm run typecheck        # tsc --noEmit
npm run check            # ultracite check
npm test                 # vitest run
npm run build            # next build
npm run mobile:build     # next build && cap sync
```

**Before:** `tsc` 0 errors · `ultracite check` 0 errors · 282 tests passing.
**After:** `tsc` 0 errors · `ultracite check` 0 errors · **286** tests passing ·
`next build` OK.

### In a browser

| Check | Result |
|---|---|
| The location step | **"Continue"** — and no ride-type choice anywhere |
| The payment step | *"How would you like to pay?"* over **"🏍️ Standard · 1 passenger(s) · ₱30"** |
| The payment methods | GCash, Maya, Cash |
| The back button | *"Back to pickup and destination"* |
| The fare | **₱30**, measured by the server |
| The pickup search | The suggestion **appears** — it never did before |
| Errors | None |

---

## Risk

| Risk | Mitigation |
|---|---|
| The legacy build's map screen throws | The quote still carries a quote for the ride type it asks for, at the same fare |
| A legacy rider books a Priority ride | It is booked as the ride that exists, at the fare they were quoted |
| Narrowing the schema makes the old rows unreadable | The rows are rewritten **before** the schema is narrowed, in a separate deploy |
| The class is still shown somewhere | It is removed everywhere it was shown, and `vehicleLabel` — the only way to show it — is gone |
| The rider loses the fare | The payment step says what the trip costs, and the fare is measured on the server |
