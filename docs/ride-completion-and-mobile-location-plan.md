# Ride Completion, the Chat Toggle, and Android Location — Implementation Plan

**Log ID:** `fixoct28`
**Created:** 2026-10-28 00:40 PST (Wednesday)
**Status:** ✅ Executed — all three waves complete
**Result:** `tsc` 0 errors · `ultracite check` 0 errors · 113 tests passing · `next build` OK · `npm run mobile:build` OK
**Related log:** [`FIXOCT28.md`](../FIXOCT28.md) at the repository root
**Previous:** [`docs/ride-matching-defects-plan.md`](ride-matching-defects-plan.md) (`fixoct27`)

---

## Overview

Three issues were reported after the `fixoct27` work, two of them from a build
installed on a phone:

1. **The commuter's map still says "Ride in progress" after the driver completes
   the trip.**
2. **The operator's map has a "Chat ON/OFF" toggle that is no longer needed.**
3. **The app installed on Android never asks for location permission.**

The first one is **already fixed in the source** — the build on the phone predates
the fix. The evidence is below, and the remaining work is to stop it from
happening again: the decision that puts the passenger's screen in the wrong state
lives inside a `useEffect`, where no test can reach it.

The second and third are new. The third has a single, definite root cause in the
Android manifest.

---

## Problem Statement

| # | Problem | Evidence |
|---|---|---|
| A | The commuter's map is stuck on "Ride in progress" after the trip ends | `getActiveForMe` matched only `pending \| accepted \| inProgress`; a finished ride was not "active", so the query returned `null` and the client's `rideStatus` never changed |
| B | The stage decision cannot be tested | It lives inside `useRideStage`'s `useEffect` — no unit test can reach it, which is why A survived |
| C | The "Chat ON/OFF" button lets a driver hide the chat mid-ride | `src/app/operator/map/page.tsx:572` — the chat is also turned on automatically when a ride is live, so the button is redundant at best |
| D | The app never asks for location on Android | `android/app/src/main/AndroidManifest.xml` declares `INTERNET` and `CAMERA` but not `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` |
| E | The location error copy says "in your browser settings" | `src/lib/geolocation.ts` — wrong wording on a device |
| F | A driver who denies location gets no feedback | `src/app/operator/map/page.tsx:242` — the watch error is `console.error` only |

---

## Issue A — The passenger's map is stuck on "Ride in progress"

### Symptom

The driver completes the trip on their side. The passenger's map keeps saying
*"Ride in progress"*, and the passenger is never offered the chance to pay or
rate.

### Root cause

`convex/rides.ts` — `getActiveForMe` resolved the passenger's ride through
`findActiveCommuterRide`, which matched:

```ts
r.status === "pending" || r.status === "accepted" || r.status === "inProgress"
```

A `completed` ride was not "active", so once the driver completed the trip the
query returned `null`. `useRideStage` then early-returned on the null ride
(`src/app/map/useRideStage.ts:39`) and the client's `rideStatus` state stayed at
`"in-progress"` for ever. The panel was frozen on the last thing it had said.

The passenger's own `cancel` button was affected the same way: it cancelled a
local id that a reload had already cleared.

### Status — already fixed, but not in the build on the phone

The `fixoct27` work (Wave 1.9 and Wave 2.9) changed this:

* `getActiveForMe` now returns the passenger's most recent **completed** ride as
  `latestCompleted` when they have no live ride.
* `findActiveCommuterRide` prefers a ride **that has a driver** over a newer
  pending one, so the passenger always sees the driver who is on the way.
* The map derives its stage from `viewedRide = liveRide ?? completedRide`, so
  *"Ride completed"* and the *Pay & Rate Driver* button are reachable.

The build installed on the phone does not contain any of it:

```bash
$ ls -la android/app/src/main/assets/public/ | head -3
drwxr-xr-x  46 …  1472  Oct 27 14:27 .

$ grep -rlo "latestCompleted" android/app/src/main/assets/public/_next/static/chunks/
                       # → nothing: the fix is not in the installed bundle

$ grep -rlo "latestCompleted" out/_next/static/chunks/
out/_next/static/chunks/6d7a40535d96d774.js:latestCompleted
                       # → present in the fresh build
```

The Android assets were last synced at 14:27 on 27 October. The `fixoct27`
changes landed from 23:30 that evening. The phone has a pre-fix build.

**The fix:** rebuild and re-sync.

```bash
npm run mobile:build      # next build && cap sync
```

### Remaining work

The bug is fixed but nothing stops it coming back. The decision that puts the
passenger's screen in the wrong state lives inside a `useEffect` in
`src/app/map/useRideStage.ts`, and no unit test can reach it. The whole class of
bug — *"the client and the server disagree about what stage the ride is in"* —
is exactly the class that `fixoct27` was about, and it has no test at all.

**A1 — Extract the stage decision into a pure function.**

`src/app/map/rideStage.ts` (new):

```ts
export type BookingStep = "location" | "vehicle" | "booking" | "tracking";
export type RideStatus =
  | "searching" | "matched" | "arriving" | "arrived" | "in-progress" | "completed";

export interface RideStage {
  status: RideStatus;
  step: BookingStep;
}

/** The stage the passenger's screen is in, for a ride in a given state. */
export function stageForRide(input: {
  isConfirmed: boolean;
  isDriverArrived: boolean;
  status: string;
}): RideStage | null;
```

The mapping:

| Server status | Confirmed | Driver arrived | Stage |
|---|---|---|---|
| `pending` | — | — | `booking` / `searching` |
| `accepted` | no | — | `booking` / `matched` |
| `accepted` | yes | no | `tracking` / `arriving` |
| `accepted` | yes | yes | `tracking` / `arrived` |
| `inProgress` | — | — | `tracking` / `in-progress` |
| `completed` | — | — | `tracking` / `completed` |
| `cancelled` | — | — | `null` — the caller resets the booking |

`useRideStage` then becomes a thin wrapper that calls `stageForRide` and applies
the result. The `"arrived"` state, which used to be a dead branch that nothing
could assign, now has a real meaning: the driver is within 100 m of the pickup
point (`src/app/map/useRideLocation.ts`).

**A2 — Test the mapping.** `tests/rideStage.test.ts` (new), one assertion per
row of the table above, plus a check that `completed` never maps to
`in-progress`. This is the test that would have caught the reported bug.

**A3 — Make a stale build obvious.** A note in the plan and the log, and a
checklist step: an APK is rebuilt with `npm run mobile:build`, and the Android
assets directory is the thing that proves it happened.

---

## Issue B — The "Chat ON/OFF" toggle

### Symptom

The operator's map has a small `Chat ON/OFF` button under the header.

### Root cause

`src/app/operator/map/page.tsx:572`:

```jsx
<button onClick={() => setShowChat((prev) => !prev)} type="button">
  Chat {showChat ? "ON" : "OFF"}
</button>
```

`showChat` is also turned on automatically whenever the driver holds a live ride
(`accepted` or `inProgress`), so the button has no job in the normal case. In
the abnormal case it is actively harmful: a driver can hide the chat while a
passenger is trying to reach them, and the passenger has no way to know the
driver has done it.

### Fix

Remove the button and the toggle. The automatic behaviour stays, so the chat
appears when the ride goes live and goes away when it ends. The chat bubble's
own controls are untouched.

---

## Issue C — The app never asks for location on Android

### Symptom

The app is installed on a phone. It never asks for location permission, so the
passenger's position is never shared and the driver cannot see them.

### Root cause

`android/app/src/main/AndroidManifest.xml` declares two permissions:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
```

**It does not declare `ACCESS_FINE_LOCATION` or `ACCESS_COARSE_LOCATION`.**

Capacitor's bridge *does* handle the prompt. In
`node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/BridgeWebChromeClient.java:246`:

```java
@Override
public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
    super.onGeolocationPermissionsShowPrompt(origin, callback);
    final String[] geoPermissions = { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION };

    if (!PermissionHelper.hasPermissions(bridge.getContext(), geoPermissions)) {
        permissionListener = (isGranted) -> { … };
        permissionLauncher.launch(geoPermissions);   // ← the Android runtime request
    } else {
        callback.invoke(origin, true, false);
    }
}
```

So the WebView asks, and the bridge asks Android for the runtime permission. But
**a permission that is not declared in the manifest can never be granted**:
`PermissionHelper.hasPermissions` keeps returning denied, the request is dropped,
and the WebView denies geolocation without ever showing a dialog. That is the
exact symptom — no prompt, no error, no position.

The camera permission was declared for the credential upload. The location
permissions were never added, because the location feature was added to the web
app after the Android project was set up.

### Fix

**C1 — Declare the permissions.**

`android/app/src/main/AndroidManifest.xml`:

```xml
<!-- The rider shares their position with the driver, and the driver's
     position is drawn on the rider's map. Capacitor's bridge asks for these
     at runtime when the WebView first asks for a location, but a permission
     that is not declared here can never be granted, and the request is
     dropped without a dialog. -->
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-feature android:name="android.hardware.location" android:required="false" />
<uses-feature android:name="android.hardware.location.gps" android:required="false" />
```

`required="false"` keeps the app installable on a device with no GPS.

This file is the app's own source, not generated: `npx cap sync android` copies
the web assets and merges the plugins' manifests, and does not overwrite it. The
change survives every sync.

**C2 — Rebuild and re-sync.**

```bash
npm run mobile:build
```

**C3 — Say something when location is refused.**

`src/lib/geolocation.ts` — `describeGeolocationError` tells the user to *"allow
location access in your browser settings"*. On a phone the setting is in the
app's own permission screen, not the browser's. The copy should be right on both.

**C4 — Tell the driver when their position is not being shared.**

`src/app/operator/map/page.tsx:242` — the `watchPosition` error handler is
`console.error(error)` and nothing else. A driver who denies location, or whose
device cannot find a fix, carries on driving with no idea that the passenger
cannot see them. The screen should say so.

**C5 — Do not prompt out of nowhere.**

The passenger's continuous sharing starts when the ride goes live, and the
one-off "use my location" button asks on demand. Neither fires on page load,
which is right: a location prompt the user did not ask for is refused far more
often than one they did. The fix is that the prompt now *appears* when it is
raised — not that it is raised more often.

### Why not the `@capacitor/geolocation` plugin?

The plugin would work and gives a slightly richer API. It is not needed here:
the Capacitor bridge already bridges the WebView's `navigator.geolocation` to
the Android runtime permission, and the missing manifest entry is the whole
problem. Adding a plugin means a native dependency, a `cap sync` that rewrites
the Android project, and a second code path for the web build — all to fix
something a manifest entry fixes.

---

## Work Breakdown

### Wave 1 — The ride stage — ✅

| # | Task | File |
|---|---|---|
| 1.1 | Extract `stageForRide` — the pure stage decision | `src/app/map/rideStage.ts` ✅ |
| 1.2 | `useRideStage` becomes a wrapper over it | `src/app/map/useRideStage.ts` ✅ |
| 1.3 | One assertion per state, including that `completed` never reads as `in-progress` | `tests/rideStage.test.ts` ✅ |
| 1.4 | Rebuild and re-sync the Android app | `npm run mobile:build` ✅ — **the APK still has to be installed on a device** |

### Wave 2 — The operator map — ✅

| # | Task | File |
|---|---|---|
| 2.1 | Remove the `Chat ON/OFF` button and the toggle | `src/app/operator/map/page.tsx` ✅ |
| 2.2 | Surface a location failure to the driver instead of `console.error` | `src/app/operator/map/page.tsx`, `src/app/operator/OperatorHeader.tsx` ✅ |

### Wave 3 — Android location — ✅

| # | Task | File |
|---|---|---|
| 3.1 | Declare `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION` | `android/app/src/main/AndroidManifest.xml` ✅ |
| 3.2 | Declare the location features as optional | `android/app/src/main/AndroidManifest.xml` ✅ |
| 3.3 | Device-appropriate wording for a refused location | `src/lib/geolocation.ts` ✅ |
| 3.4 | Rebuild and re-sync | `npm run mobile:build` ✅ — **the APK still has to be installed on a device** |

---

## Test Plan

| # | Assertion |
|---|---|
| T1 | A ride in `completed` maps to `tracking` / `completed`, never to `in-progress`. |
| T2 | A ride in `inProgress` maps to `tracking` / `in-progress`. |
| T3 | A ride in `accepted` that is not confirmed maps to `booking` / `matched`. |
| T4 | A ride in `accepted` that is confirmed maps to `tracking` / `arriving`. |
| T5 | A confirmed ride with the driver arrived maps to `tracking` / `arrived`. |
| T6 | A ride in `pending` maps to `booking` / `searching`. |
| T7 | A ride in `cancelled` maps to `null`, so the booking is reset. |
| T8 | An unknown status maps to `null` rather than to a wrong stage. |
| T9 | The manifest declares both location permissions. |
| T10 | The operator map has no chat toggle button. |

T9 and T10 are file assertions, in the style of the existing
`tests/convex/noHardcodedCredentials.test.ts`.

---

## Verification

```bash
npm run typecheck        # tsc --noEmit
npm run check            # ultracite check
npm test                 # vitest run
npm run build            # next build
npm run mobile:build     # next build && cap sync
```

**Baseline before the fix:** `tsc` 0 errors · `ultracite check` 0 errors · 102
tests passing · `next build` OK.

**After the fix:** `tsc` 0 errors · `ultracite check` 0 errors · 113 tests
passing (102 + 11 new) · `next build` OK — 13 static routes prerender ·
`npm run mobile:build` OK, with the Android bundle rebuilt and synced.

### What was built

| Plan item | Where it landed |
|---|---|
| The stage decision, extracted | `src/app/map/rideStage.ts` — `stageForRide`, a pure function with the whole table in it. |
| `useRideStage` | A thin wrapper over `stageForRide`. |
| One shared `RideStatus` | `src/app/map/rideStage.ts` — `RideProgressPanel` and the map page no longer keep their own copies. |
| The stage mapping, tested | `tests/rideStage.test.ts` — eight assertions, including that a finished ride never reads as still in progress. |
| The chat toggle | Gone. The chat appears on its own while a ride is live, and there is no way for a driver to hide it from a passenger. |
| The driver's position | `src/app/operator/map/useDriverPosition.ts` — the position, and whether it is being shared. |
| The passenger's pin and the road | `src/app/operator/map/usePassengerMarker.ts`. |
| The two banners | `src/app/operator/OperatorHeader.tsx` — the *Go online* and *location* notices. |
| The location error copy | `src/lib/geolocation.ts` — it now says where the setting actually is. |
| The manifest | `android/app/src/main/AndroidManifest.xml` — `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, and the two optional features. |
| The manifest and the toggle, tested | `tests/mobileBuild.test.ts` — three assertions. |

The operator map page went from 861 lines to 483 over this batch and the
`fixoct27` one.

**On a device:** the passenger is asked for location the first time the map
asks for a position; the driver is asked when the operator map opens; the
passenger's screen leaves *"Ride in progress"* when the driver completes the
trip; and the chat is on whenever a ride is live, with no toggle to turn it off.

---

## Risk

| Risk | Mitigation |
|---|---|
| The manifest edit is lost on a re-scaffold | `android/app/src/main/AndroidManifest.xml` is the app's own file, not generated. `cap sync` does not overwrite it. It is under version control. |
| The stage extraction changes the screen's behaviour | The mapping table is the same one the hook already implements, character for character. The new tests pin it. |
| Removing the chat toggle leaves a driver unable to hide the chat | The chat only appears while a ride is live, and it is information the passenger needs. The bubble's own close control is unaffected. |
| A new runtime permission makes the install prompt scarier | Two location permissions, no storage, no camera. Android shows them the first time the app asks, not at install. |
