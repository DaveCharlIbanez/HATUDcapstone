# Pre-Booking Payment Modality — Implementation Plan

**Log ID:** `fixoct38`
**Created:** 2026-11-02 09:10 PST (Monday)
**Status:** ✅ Executed — all five waves complete
**Result:** `tsc` 0 errors · `ultracite check` 0 errors · 234 tests passing · `next build` OK
**Related log:** [`FIXOCT38.md`](../FIXOCT38.md) at the repository root
**Previous:** [`docs/ui-refurbish-plan.md`](ui-refurbish-plan.md) (`fixoct36`)

---

## Overview

The app had no payment method to choose. `src/app/payment/page.tsx` hardcoded
"Pay with GCash" and asked for a phone number; `convex/schema.ts` held
`provider: v.literal("gcash")` — a single-value literal, not a union. The
terms promised *"payment options such as cash and supported electronic wallet
services"* (`src/lib/terms.ts`), and a dead `ConvexPaymentMethod` interface
sat in `src/lib/convexConfig.ts` with `type: "card" | "cash"` behind it.

This is the introduction of the choice, and where it belongs: **before the
ride is booked**. A driver has to know whether they are collecting cash
before they accept a request, and a rider who is going to hand over notes
should not be asked to decide that after the trip has ended.

| Modality | Chosen at | Money moves | Who settles it |
|---|---|---|---|
| GCash | booking | after the trip ends | the rider, on `/payment` |
| Maya | booking | after the trip ends | the rider, on `/payment` |
| Cash | booking | physically, at the drop-off | **the driver confirms the handover** |

Two further things came out of the same work, because the second one changed
the third:

1. **Only the choice moves.** The wallet charge stays after the trip. Charging
   at booking would take money for rides that get cancelled, and the app has
   no refund path — `payments.status` carries `REFUNDED` but nothing
   implements it.
2. **The commuter's confirmation now starts the ride.** The passenger's button
   said "Confirm & Start Ride" and started nothing; the driver's own "Picked
   Up" tap did that. There were two ways to start the same ride and only one
   of them recorded a confirmation.

---

## The finding that shaped the brief

```
rg -i "paymentMethod|paymentModality|payment_method|payment_modality"
→ 0 matches across the whole repository
```

There was no chooser to move. The post-ride screen had a *wallet* and a
number field. The task was not a refactor; it was an introduction with a
placement decision attached.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Where the choice is made | At booking, as its own step | The driver has to know before accepting. A dedicated step says what will happen with each option, against the fare |
| Which modalities | GCash, Maya, Cash | One wallet that already had a sandbox, a second through the same seam, and the one that needs a human |
| The wallet charge | Stays after the trip | Charging at booking takes money for cancelled rides and needs a refund path that does not exist |
| Who confirms a cash handover | The driver | They are the one holding the money. The server will not close a cash ride without it |
| A ride with no method | Read as GCash | Those rides were all settled through GCash, because it was the only thing the app could do |
| The method on the ride vs on the payment | Two fields, two meanings | `rides.paymentMethod` is the intent, fixed at booking. `payments.provider` is the settlement, where the money actually moved |
| The "Confirm" button | Says "Confirm" | It starts the ride now, so the label is accurate. "Confirm & Start Ride" was a claim the code did not honour |

### Non-goals

* Pre-authorising a wallet at booking time.
* Saving a default payment method on the passenger's profile.
* A real gateway. Both wallets are sandboxes; no money moves.
* Changing the fare tariff.

---

## Architecture

### 1. The one place the list lives — `convex/lib/paymentMethods.ts` (new)

```ts
export const PAYMENT_METHODS = ["gcash", "maya", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const paymentMethodValidator = v.union(
  v.literal("gcash"), v.literal("maya"), v.literal("cash")
);
export const DEFAULT_PAYMENT_METHOD: PaymentMethod = "gcash";
export function isElectronic(method: PaymentMethod): boolean;
export function methodOf(method: PaymentMethod | null | undefined): PaymentMethod;
```

The schema, the booking, the charge, the screens and the tests all read it,
so a method cannot exist in one place and be missing from another.

### 2. The schema — `convex/schema.ts`

| Table | Change |
|---|---|
| `rides` | **new** `paymentMethod: v.optional(v.union(v.literal("gcash"), v.literal("maya"), v.literal("cash")))` — optional so the rows that predate it stay valid, **required** in the booking write |
| `payments` | `provider: v.literal("gcash")` → `v.union(v.literal("gcash"), v.literal("maya"), v.literal("cash"))` — a widening, so no row is rewritten |

### 3. The provider seam — `convex/lib/payments.ts`

`GcashChargeRequest` and `GcashChargeResult` became `ChargeRequest` and
`ChargeResult`, and `PaymentProvider` gained a `method`. Both sandboxes are
built by one factory, and each has its own decline number so the failure
path can be shown per wallet:

| Wallet | Decline number |
|---|---|
| GCash | `09179000000` |
| Maya | `09179000001` |

`buildPaymentRow` writes the payment row for **both** settlement paths, so the
ledger reads the same whichever way the money moved.

**Cash is deliberately not a provider.** There is no gateway to call for a
handover of notes, and pretending otherwise would hide the only part of the
flow a human is involved in.

### 4. The public surface — `convex/payments.ts`

| Function | Change |
|---|---|
| `charge` | Dispatches on the **ride's booked method**, never on a client-supplied one. A cash ride is refused: *"This ride is paid in cash — hand the fare to your driver at the drop-off."* |
| `prepare` | Returns the method as well as the amount and the reference |
| `record` | Writes the method onto the payment row |
| `getDue` | Reports the method, so the page can say which wallet it is asking for |

### 5. The atomic completion — `convex/rideCompletion.ts` (new)

A cash ride is settled by the driver confirming the handover, and the
completion and that settlement have to be **one transaction**: a ride that
closed without the confirmation would leave the driver's cash unrecorded and
the ledger saying the ride was never paid.

`rides.complete` became a thin public wrapper over
`internal.rideCompletion.complete`, mirroring `rides.create` → `rideBooking.insert`.

### 6. The ride lifecycle — `convex/rides.ts`, `convex/lib/rideState.ts`

```
pending  ──(operator accepts)──▶  accepted  ──(commuter confirms)──▶  inProgress  ──(operator completes)──▶  completed
```

| Change | Why |
|---|---|
| `confirm` sets `confirmedAt` **and** `status: "inProgress"` | The passenger's confirmation starts the trip |
| `confirm` is idempotent | A double tap, or a retry after a slow connection, is not a second ride |
| `OPERATOR_STATUSES` drops `"inProgress"` | Only the passenger starts the ride. A driver could start it and the ride would carry no `confirmedAt` |
| `complete` requires `inProgress` | A driver could finish a ride that never began, which would make the confirmation optional |
| `rideNeedsAttention` asks `rideOwesPayment` | A cash ride never "needs payment", so the dashboard stops sending a rider to a page to pay cash through |
| `expireStaleAcceptedRides` (cron) | An accepted ride nobody confirmed holds the driver on the job and counts as the rider's live ride, which blocks their next booking |

### 7. The arrival gate — `convex/lib/arrival.ts` (new)

The ride becoming `inProgress` switches the road drawn on both maps from the
pickup to the drop-off. When only the driver's own tap could do that, the
road switched exactly when the driver was at the pickup. With the passenger's
confirmation doing it, a passenger who confirms too early would **redirect the
driver's navigation while they are still three kilometres away**.

So the rule lives in one file, in the Convex tree, and both sides read it:

| Condition | Server | Client |
|---|---|---|
| Position fresh and more than 100 m away | Refuses: *"Your driver is still on the way."* | Button disabled, reason shown |
| Position fresh and within 100 m | Allows | Button enabled |
| Position missing or older than two minutes | **Allows** | Button enabled |

A missing or stale fix must never lock a passenger out of a trip, so the
driver is only judged when there is fresh evidence.

### 8. The client — `src/app/map/`

| File | Change |
|---|---|
| `PaymentMethodPicker.tsx` (new) | The chooser. Native radio inputs inside labels, each card saying what will happen — *"Hand ₱45 to your driver when the trip ends"* |
| `rideStage.ts` | `BookingStep` gains `"payment"`. `RideStatus` loses `"arriving"` and `"arrived"` |
| `useRideStage.ts` | The optimistic flag now means *"the trip has started"* |
| `useRideLocation.ts` | Reports `isDriverArrived` and `isDriverOnTheWay` from the shared rule |
| `RideProgressPanel.tsx` | The button says **"Confirm"**; the arrival line; the reason it is disabled |
| `page.tsx` | The new step, the method state, the booking call |
| `VehiclePicker.tsx` | "Continue with Standard" |

### 9. The other surfaces

| File | Change |
|---|---|
| `src/app/payment/page.tsx` | **No chooser any more.** It reports the booked method and asks for that wallet's number; a cash ride gets a *"hand the fare to your driver"* notice and no Pay button |
| `src/lib/format.ts` | `PAYMENT_METHOD_LABELS` and `paymentMethodLabel()` — the **label** |
| `src/app/profile/page.tsx` | The transaction history says which method; the outstanding balance ignores a cash ride |
| `src/app/operator/map/RideQueueSheet.tsx` | The method on every open request, **before** the driver accepts |
| `src/app/operator/map/RideDetailSheet.tsx` | The same, in the detail sheet |
| `src/app/operator/map/CurrentRidePanel.tsx` | The method, *"Waiting for the passenger to confirm"*, and *"Cash collected ₱45"* on a cash ride |
| `src/app/admin/page.tsx`, `src/components/admin/AdminPanels.tsx` | The revenue is read by method |
| `src/lib/terms.ts` | The payments clause names the methods the app actually offers |
| `src/lib/convexConfig.ts` | The dead `ConvexPaymentMethod` interface is gone |

---

## Work Breakdown

### Wave 1 — The model ✅

| # | Task | File |
|---|---|---|
| 1.1 | The method union, the validator, the legacy default | `convex/lib/paymentMethods.ts` |
| 1.2 | `rides.paymentMethod`, and `payments.provider` widened | `convex/schema.ts` |

### Wave 2 — The money ✅

| # | Task | File |
|---|---|---|
| 2.1 | The generalised seam and the Maya sandbox | `convex/lib/payments.ts` |
| 2.2 | The shared payment row and the reference numbers | `convex/lib/payments.ts` |
| 2.3 | The charge dispatches on the ride's method | `convex/payments.ts` |
| 2.4 | The atomic completion and the cash settlement | `convex/rideCompletion.ts` |
| 2.5 | The booking carries the method | `convex/rides.ts`, `convex/rideBooking.ts` |
| 2.6 | A cash ride never owes money through the app | `convex/lib/rideState.ts` |
| 2.7 | The backfill for the rides that predate the choice | `convex/repair.ts` |

### Wave 3 — The screens ✅

| # | Task | File |
|---|---|---|
| 3.1 | The chooser | `src/app/map/PaymentMethodPicker.tsx` |
| 3.2 | The new step and the booking call | `src/app/map/page.tsx` |
| 3.3 | The labels | `src/lib/format.ts` |
| 3.4 | The payment page reports the booked method | `src/app/payment/page.tsx` |
| 3.5 | The profile, the admin and the driver's screens | `src/app/profile/page.tsx`, `src/app/admin/page.tsx`, `src/components/admin/AdminPanels.tsx`, `src/app/operator/map/*` |

### Wave 4 — The lifecycle ✅

| # | Task | File |
|---|---|---|
| 4.1 | The confirmation starts the ride | `convex/rides.ts` |
| 4.2 | The operator cannot start the ride | `convex/rides.ts` |
| 4.3 | A ride cannot end before it began | `convex/rideCompletion.ts` |
| 4.4 | The arrival gate, on both sides | `convex/lib/arrival.ts`, `src/app/map/useRideLocation.ts` |
| 4.5 | The stage machine loses "arriving" | `src/app/map/rideStage.ts`, `src/app/map/useRideStage.ts` |
| 4.6 | The button says "Confirm" | `src/app/map/RideProgressPanel.tsx` |
| 4.7 | "Picked up" is gone from the driver's panel | `src/app/operator/map/CurrentRidePanel.tsx`, `src/app/operator/map/page.tsx` |
| 4.8 | A ride nobody confirms is dropped | `convex/crons.ts` |

### Wave 5 — Verification ✅

| # | Task | File |
|---|---|---|
| 5.1 | The method and the cash settlement | `tests/convex/paymentMethod.test.ts` |
| 5.2 | The lifecycle | `tests/convex/rideLifecycle.test.ts` |
| 5.3 | The stage machine | `tests/rideStage.test.ts` |
| 5.4 | The booking calls carry a method | `tests/convex/rides.test.ts`, `tests/convex/routing.test.ts`, `tests/convex/matching.test.ts` |
| 5.5 | The seed and the backfill | `convex/seed.ts`, `convex/repair.ts` |

---

## The legacy fleet

`capacitor.config.ts` has **no `server.url`**. An APK carries the web code as
bundled assets, so its screens are frozen at build time and it cannot be
changed — it can only call the server.

Which makes the server's answer to the calls the old build already makes the
only thing that can move. `fixoct38` changed three of them, and one of the
breaks was fatal: **the old APK could not book a ride at all**, because
`paymentMethod` had become a required argument.

The shipped artifact was extracted and read rather than guessed at:

| The old bundle calls | Found in `HATUD-v1.2-debug.apk` |
|---|---|
| `rides.create` | `{sessionToken, commuterId, pickup, dropoff, vehicleType}` — **no `paymentMethod`** |
| `rides.updateStatus` | `{sessionToken, id, status:"inProgress"}` — the driver's "Picked up" |
| `rides.complete` | `{sessionToken, id, operatorId}` — **no `cashCollected`** |

### The rule

> **The server accepts what every shipped client can send, and the new
> client's richer calls are additive.**

`convex/lib/legacyClients.ts` is the compatibility window, modelled on the
repo's own `convex/lib/legacyAccess.ts` — the same purpose, the same shape,
and a cutover checklist so the removal is one deletion rather than a hunt
through the payment flow.

| Break | Fix |
|---|---|
| The booking required a method | `paymentMethod` is `v.optional(...)`. Absent → **GCash**, which is what the old build could do and what every legacy ride was settled through. An *invalid* method is still refused |
| The driver could not start a ride | `OPERATOR_STATUSES` is `["inProgress"]` again, as a **fallback** for a passenger who never confirms |
| The driver's "Picked up" errored on a running trip | `legacyStartIsRedundant()` makes it a no-op that **succeeds** |
| A cash trip could not be closed | The completion settles the cash either way. The flag is advisory and records `rides.cashCollectedAt` |

### Two decisions that were reversed

The passenger's confirmation is the **primary** way to start a ride, not the
only one. A passenger who is asleep, whose phone is dead, or who simply never
taps the button would otherwise strand the trip *and* the driver. The data
tells the two paths apart: `confirmedAt` is set when the passenger confirmed,
and absent when the driver started it.

The strict cash guard was a nicer rule and a worse product. **A cash trip
that cannot be closed is a trip that happened but can never be recorded**, and
that is worse than a trip whose collection was not explicitly confirmed.

### The check that would have caught it

`tests/legacyApk.test.ts` reads the shipped APK — inflating the bundle out of
the archive with nothing but Node's own `zlib` — lists every Convex function
it calls, and asserts that each one is still a public function on the server.
It was verified by renaming a function and watching it fail.

The *shape* of the arguments is checked in `tests/convex/legacyClients.test.ts`,
which calls the real functions the way the old build does.

### The cutover

```bash
npm run mobile:build
npx cap sync android
cd android && ./gradlew assembleDebug     # needs JDK 21 and the Android SDK
```

That produces `versionCode 4` / `versionName 1.3`. Once the fleet has
migrated, `convex/lib/legacyClients.ts` is deleted, `paymentMethod` becomes
required again, the operator's `inProgress` goes, and `cashCollected` becomes
required on a cash completion — all four steps are listed in the file's own
header.

---

## Test Plan

| # | Assertion |
|---|---|
| T1 | A booking stores the method the rider chose |
| T2 | A booking without a method is refused |
| T3 | The charge uses the ride's booked method, not a client-supplied one |
| T4 | Maya settles as Maya and GCash as GCash |
| T5 | Each wallet declines its own designated test number, and only its own |
| T6 | Charging a cash ride through the app is refused |
| T7 | A cash ride cannot be completed until the driver confirms the collection |
| T8 | A confirmed cash collection settles the ride in the same transaction |
| T9 | A cash ride never appears as owing money through the app |
| T10 | The due query reports the booked method |
| T11 | A ride that predates the choice still settles as GCash |
| T12 | The repair marks the live rides that predate the choice as GCash |
| T13 | The passenger's confirmation starts the trip |
| T14 | Confirming twice is a no-op, not an error |
| T15 | A driver cannot start the trip themselves |
| T16 | A driver cannot finish a trip that was never confirmed |
| T17 | A confirmation is refused while the driver is still on the way |
| T18 | A confirmation is allowed when the driver has reported nothing, or nothing fresh |
| T19 | A ride nobody confirms is dropped by the expiry job |
| T20 | A trip that is under way is not dropped by the expiry job |
| T21 | The stage machine has no "arriving" stage |
| T22 | A booking that sends no method is booked as GCash, for the old builds |
| T23 | A booking that sends an invented method is still refused |
| T24 | The driver's fallback starts a ride the passenger never confirmed |
| T25 | The driver's fallback on a ride already under way succeeds |
| T26 | The passenger's confirmation is recorded whichever order it happens in |
| T27 | A cash ride can be closed by a build that does not confirm the collection |
| T28 | Every Convex function the shipped APK calls is still on the server |

---

## Verification

```bash
npm run typecheck        # tsc --noEmit
npm run check            # ultracite check
npm test                 # vitest run
npm run build            # next build
npm run mobile:build     # next build && cap sync
```

**Before:** `tsc` 0 errors · `ultracite check` 0 errors · 209 tests passing.
**After:** `tsc` 0 errors · `ultracite check` 0 errors · **247** tests passing ·
`next build` OK · the Android assets synced.

---

## Risk

| Risk | Mitigation |
|---|---|
| The passenger confirms early and the driver's navigation jumps to the drop-off | The server refuses a confirm while the driver's fresh position is more than 100 m from the pickup; the client mirrors it exactly |
| The passenger never confirms, and the ride is stuck `accepted` | A cron cancels it after thirty minutes; the driver can cancel immediately |
| A driver finishes a ride that never began | `complete` requires `inProgress` |
| A ride under way with no `confirmedAt` | Only the passenger can set `inProgress` |
| Legacy rides have no method | Optional field; `repair.paymentMethod` backfills the live ones; readers default to GCash |
| The rider picks cash and the driver expects a wallet | The driver sees the method in the queue before accepting and on the current-ride panel |
| The charge moves to the wrong modality | The method is read from the ride, never from the client |
| An older Android build cannot finish a cash ride | **Fixed.** The completion settles the cash either way; the flag only records that the driver said so explicitly |
| `getDue` returns one trip only | Pre-existing limitation, unchanged. A rider with two unsettled trips still sees the newest. Not fixed here |
