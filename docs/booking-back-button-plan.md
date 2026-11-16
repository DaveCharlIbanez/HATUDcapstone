# The Booking Back Button — Implementation Plan

**Log ID:** `fixoct39`
**Created:** 2026-11-03 00:20 PST (Tuesday)
**Status:** ✅ Executed
**Result:** `tsc` 0 errors · `ultracite check` 0 errors · 255 tests passing · `next build` OK · verified in a browser
**Related log:** [`FIXOCT39.md`](../FIXOCT39.md) at the repository root
**Previous:** [`FIXOCT38.md`](../FIXOCT38.md) (`fixoct38`)

---

## Overview

The booking sheet is a sequence of steps — the pickup and the destination,
the vehicle, the payment method — and until the ride is created every one of
them can be left. There was no way to do that.

The sheet could only be **dismissed**, and dismissing threw the whole booking
away and put the rider back on the map. So a rider who had chosen a vehicle
and then wanted a different one, or who had reached the payment method and
wanted to change their mind about the vehicle, had to start again.

`fixoct38` made it worse rather than better: it added a third step. The
payment method is the first step in the sheet's history that a rider can
reach and then wish they could undo.

---

## The distinction that matters

There are two ways out of the sheet, and they are not the same thing.

| | Drag the sheet away | The back button |
|---|---|---|
| What it does | Throws the booking out | Steps back through it |
| The pickup and the destination | Gone | Still there |
| The vehicle | Gone | Still there |
| The payment method | Gone | Still there |
| Where the rider lands | The map, from the start | The previous step |

A back button that reset the booking would be a worse version of the
dismiss gesture wearing a different name. The whole point is that going back
costs the rider nothing.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Where the button lives | At the top of the sheet body, above the step's own heading | It reads as belonging to the sheet rather than to one step, and it is the first thing in the thumb's reach |
| What it says | Where it goes — *"Back to pickup and destination"*, *"Back to choose a ride"* | A rider is never guessing which of the previous steps they will land on |
| Where the rule lives | `backTargetFor()` in `rideStage.ts`, beside the rest of the step machine | The step machine is the one description of the sheet, and it is testable there |
| What it does to the state | Nothing | Going back costs the rider nothing |
| While the ride is being created | Disabled | The request is already on its way; leaving the step would leave the rider looking at a booking they did not make |
| On a ride that is under way | Not shown | A ride that has been booked is not a step — it is a trip somebody is on |

### Non-goals

* Changing what the sheet's dismissal does. It still resets, and it is
  deliberately a different gesture from going back.
* A back button on the driver's map. The driver has one job at a time.
* Un-booking a ride that has been created.

---

## Architecture

### 1. The rule — `src/app/map/rideStage.ts`

```ts
export function backTargetFor(step: BookingStep): BookingStep | null {
  if (step === "vehicle") {
    return "location";
  }
  if (step === "payment") {
    return "vehicle";
  }
  return null;
}
```

`null` means there is nowhere to go back to: the first step, and the two
steps that belong to a ride that is under way. The labels sit next to it:

```ts
export const BACK_LABELS: Record<string, string> = {
  location: "Back to pickup and destination",
  vehicle: "Back to choose a ride",
};
```

### 2. The button — `src/app/map/BookingBack.tsx` (new)

A real `<button>` with an icon and a name that says where it goes. It is
disabled while the ride is being created.

### 3. The wiring — `src/app/map/page.tsx`

```ts
const handleGoBack = useCallback(() => {
  if (isBooking) {
    return;
  }
  const target = backTargetFor(step);
  if (target) {
    setStep(target);
  }
}, [isBooking, step]);
```

Nothing else is touched. The pickup, the destination, the vehicle and the
payment method are all still there when the rider comes forward again.

### 4. One label that had to change

The vehicle picker's button said `Book ${selectedName ?? ""}` — which read
**"Book "** with nothing after it when no vehicle had been chosen. It now
reads **"Select a ride"**, which is what the button is asking for, and it
does not collide with the step's own heading, which also says "Choose a
ride".

---

## Work Breakdown

| # | Task | File |
|---|---|---|
| 1.1 | The rule and the labels | `src/app/map/rideStage.ts` |
| 1.2 | The button | `src/app/map/BookingBack.tsx` |
| 1.3 | The handler and where it renders | `src/app/map/page.tsx` |
| 1.4 | The vehicle picker's button label | `src/app/map/VehiclePicker.tsx` |
| 2.1 | The rule, behaviourally | `tests/rideStage.test.ts` |
| 2.2 | The wiring, and the difference from a reset | `tests/bookingBack.test.ts` |

---

## Test Plan

| # | Assertion |
|---|---|
| T1 | Every step before the ride is created can be left |
| T2 | The first step and a live ride have nowhere to go back to |
| T3 | The back button says where it goes |
| T4 | The booking sheet offers a dedicated back button |
| T5 | The back button is a real button that names where it goes |
| T6 | Going back is not a reset |
| T7 | A step cannot be left while the ride is being created |
| T8 | Dismissing the sheet is still a reset, and is not the back button |

---

## Verification

```bash
npm run typecheck        # tsc --noEmit
npm run check            # ultracite check
npm test                 # vitest run
npm run build            # next build
npm run mobile:build     # next build && cap sync
```

**Before:** `tsc` 0 errors · `ultracite check` 0 errors · 247 tests passing.
**After:** `tsc` 0 errors · `ultracite check` 0 errors · **255** tests passing ·
`next build` OK.

### In a browser

Driven with Playwright against the dev server, as a real rider:

| Step | Result |
|---|---|
| The location step | No back button — it is the first step |
| The vehicle step | **"← Back to pickup and destination"**, and the fare quote is on screen |
| Press back | The location step, with the pickup **10.73570, 121.95150** and the dropoff **Robinsons Supermarket** still there, and both markers still on the map |
| Forward again | The vehicle is **still selected** — the button still reads "Continue with Standard", and it is enabled |
| The payment step | **"← Back to choose a ride"** |
| Press back | The vehicle step, with the selection intact |

---

## Risk

| Risk | Mitigation |
|---|---|
| Going back loses the rider's work | The handler changes the step and nothing else; a test asserts it never calls `resetBooking` |
| The rider leaves a step while the ride is being created | The button is disabled while the request is in flight, and the handler refuses as well |
| The back button is mistaken for the sheet's dismissal | They are different gestures with different outcomes, and a test says so |
| The button is offered on a ride that is under way | `backTargetFor` returns `null` for the booking and tracking steps |
