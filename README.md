# HATUD

A ride-hailing app for commuters and drivers in Antique, Philippines. Passengers
book a ride, drivers accept it, and the fare is settled through a GCash
sandbox payment.

The app is a Next.js 16 static export bundled for Android with Capacitor, and
it talks to a [Convex](https://convex.dev) backend.

---

## Stack

| Layer | Technology |
|---|---|
| Front end | Next.js 16 (App Router), React 19, Tailwind CSS 4, MapLibre GL |
| Backend | Convex (queries, mutations, actions, cron) |
| Mobile | Capacitor 8 (Android) |
| Validation | convex-test + vitest |
| Lint / format | Ultracite (Biome) |

The app is built as a static export (`output: "export"`), because Capacitor
bundles the web build into the APK. There is no server runtime in the shipped
app, which is why the session token is kept in `localStorage` and passed to
Convex explicitly on every call.

---

## Getting started

### 1. Install and configure

```bash
npm install
cp .env.example .env.local
```

`.env.local` needs the Convex deployment to talk to:

```bash
CONVEX_DEPLOYMENT=dev:<your-deployment>
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://<your-deployment>.convex.site
```

### 2. Start Convex and the app

```bash
npx convex dev      # pushes the functions and generates the API bindings
npm run dev         # http://localhost:3000
```

`npx convex dev` must run at least once before the app will build — the
generated types in `convex/_generated/` are what the client imports.

### 3. Seed demo data

Seeding is disabled unless the deployment has the relevant environment
variables set:

```bash
npx convex env set SEED_KEY "$(openssl rand -hex 16)"
npx convex env set SEED_ADMIN_PASSWORD "<admin password>"
npx convex env set SEED_USER_PASSWORD "<password for the other accounts>"
```

Then run the seed. Note the `internal.` prefix — these functions are not
reachable from a client:

```bash
npx convex run internal.seed.seed '{"seedKey":"<the key you set>"}'
```

To wipe the database and start over:

```bash
npx convex run internal.seed.forceReset '{"seedKey":"<the key you set>"}'
```

Seeded accounts: `admin@hatud.com`, `commuter1@hatud.com`,
`commuter2@hatud.com`, `operator1@hatud.com`, `operator2@hatud.com`.

> The seed key is the only thing standing between a leaked function reference
> and a wiped database. Keep `SEED_KEY` out of the repository, and rotate it if
> it is ever exposed.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Static export into `out/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | Ultracite (Biome) lint and format check |
| `npm run check:write` | Ultracite auto-fix |
| `npm test` | Convex unit tests (convex-test + vitest) |
| `npm run test:watch` | The same, in watch mode |
| `npm run mobile:build` | Build and sync to the Android project |
| `npm run mobile:android` | Build, sync and open Android Studio |

---

## Architecture

### The access model

Every Convex function that returns data about a person lives behind an
**intent-scoped query** whose name encodes who may call it:

| Query | Who may call it |
|---|---|
| `commuters.getSelf` | The passenger themselves |
| `operators.getSelf` | The driver themselves |
| `commuters.getForRide` | A driver on the same ride |
| `operators.getForRide` | A passenger on the same ride |
| `rides.getActiveForMe` | The caller, for their own ride |
| `rides.getPartnerLocation` | A participant on that ride |
| `operators.listAvailable` | Drivers |
| `adminQueries.*` | Admins |

Responses are **projected** (`convex/lib/projections.ts`), so a passenger never
receives a driver's licence number or live position, and a driver never
receives a passenger's email or saved home addresses.

Generic by-id lookups (`getById`, `getByEmail`, `listByRole`) were removed
entirely: they had no callers and were unauthenticated enumeration points.

### Sessions

`convex/lib/withAuth.ts` resolves a session token into an `Actor` — the user id,
the role, and the id of the caller's own role profile, all derived server-side.
Clients never send a user id for authorisation purposes.

### Fares

Fares are computed and locked in on the server when the ride is created, from
the pickup and dropoff coordinates (`convex/lib/fare.ts`):

There is one kind of ride, and one fare for it:

| Vehicle | Base | Included | Per started km |
|---|---|---|---|
| Standard | ₱30 | 2 km | ₱12 |

The distance charged is the **road** distance, measured by OSRM — the same
routing service that draws the route on the map, so the price and the route
the passenger is shown always agree. OSRM's routing algorithm is Dijkstra over
the OpenStreetMap road graph.

The measurement is remembered in a `routeDistances` cache keyed by the rounded
coordinates, and the quote and the booking read the same row, so a passenger is
never quoted one price and charged another. When the router cannot be reached
the fare falls back to a straight-line estimate scaled by a circuity factor of
1.18, recalibrated by measuring three hundred real trips in Antique. The client
sends no amount and cannot influence the price.

Booking and quoting are Convex **actions**, not mutations, because a Convex
mutation cannot make a network call. The write itself is an internal
mutation (`convex/rideBooking.ts`).

### Payments

The rider chooses how they are paying **when they book**, and the ride
carries that choice for its whole life — the driver has to know before they
accept whether they are collecting cash. The methods are GCash, Maya and
cash, and the list lives in one place: `convex/lib/paymentMethods.ts`.

| Method | Money moves | Who settles it |
|---|---|---|
| GCash | after the trip ends | the rider, on `/payment` |
| Maya | after the trip ends | the rider, on `/payment` |
| Cash | at the drop-off | the driver, who confirms the handover |

`convex/lib/payments.ts` defines a `PaymentProvider` seam. The wallet
implementations are **sandboxes** — no money moves. Each has a designated
test number that always declines (`09179000000` for GCash, `09179000001` for
Maya), so the failure path can be demonstrated. Swapping in the real gateways
means replacing those two implementations.

The charge runs as a Convex *action* (gateway calls may take time), which
prepares the charge through an internal mutation and records the outcome
through another. The method is read from **the ride**, never from the
request, so a client cannot ask to be charged through a method it did not
book. Cash is not a provider: there is no gateway for a handover of notes,
and the driver's confirmation of it is what settles the ride — in the same
transaction that closes it.

---

## Ride lifecycle

```
pending  ──(operator accepts)──▶  accepted  ──(commuter confirms)──▶  inProgress  ──(operator completes)──▶  completed
```

The passenger's confirmation starts the trip. It is refused while the driver
is demonstrably still on the way, because the ride becoming `inProgress`
switches the road drawn on both maps from the pickup to the drop-off — a
driver three kilometres away would be sent to the wrong place. A driver whose
position is missing or stale is not judged: a missing fix must never lock a
passenger out of a trip. The rule is in `convex/lib/arrival.ts` and both
sides read it.

---

## The compatibility window

An APK carries the web code as bundled assets, so the screens inside it are
frozen at build time and cannot be changed. The Android builds that predate
`fixoct38` are still on phones, and they cannot send a payment method, they
start the trip with the driver's own "picked up" tap, and they do not know
that a cash ride needs its collection confirmed.

`convex/lib/legacyClients.ts` keeps those requests working while their users
move to the new build. It is deliberately separate from the payment flow so
the cutover is a single self-contained deletion. Its header carries the
checklist:

1. ship the rebuilt APK and confirm the fleet has migrated,
2. delete that file,
3. make `paymentMethod` required again on the booking,
4. drop the operator's `inProgress` and the redundant start,
5. require `cashCollected` on a cash completion again.

To build the new APK:

```bash
npm run mobile:build
npx cap sync android
cd android && ./gradlew assembleDebug     # needs JDK 21 and the Android SDK
```

`tests/legacyApk.test.ts` reads the shipped APK and asserts that every
Convex function it calls is still on the server — the check that would have
caught a breaking change before it shipped.

---

## Mobile build

```bash
npm run mobile:build
npx cap sync android
npx cap open android
```

Then build the APK from Android Studio, or:

```bash
npm run mobile:apk      # next build + cap sync + gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/`.

### What the APK needs

| | |
|---|---|
| **JDK 17 or newer** | Android Gradle Plugin 8.13 will not run on an older one. On a Mac with Homebrew's `openjdk@21`: `export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` |
| **The Android SDK** | `export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools` — the path is written to `android/local.properties`, which is machine-specific and not committed |
| **A debug signing key** | The release build type has no signing configuration, so the APK is signed with the local debug key. It installs over the previous build — the key is the same one — so the app's data survives the upgrade |

`versionCode` and `versionName` live in `android/app/build.gradle`. Bump them
for every build you put in front of anybody: an Android device refuses an
upgrade whose code is not higher than the one it already has.

> **After upgrading the backend**, older APKs stop working. The nine reads
> that predate session-token auth still work without a token during the
> transition — see `convex/lib/legacyAccess.ts` — but they return projected
> data only. Once the fleet has migrated, that file is deleted and the token
> becomes required on every query.
>
> The same applies to the ride type and the payment method: the builds that
> predate them still ask for a Priority ride and send no payment method, and
> the server still answers them — see `convex/lib/legacyClients.ts`.

---

## The booking sheet

The rider's booking is a sequence of steps in one sheet:

```
pickup and destination ──▶ vehicle ──▶ payment method ──▶ the ride
```

Every step before the ride is created can be left, and the **back button**
says where it goes — *"Back to pickup and destination"*, *"Back to choose a
ride"*. Going back costs the rider nothing: the pickup, the destination, the
vehicle and the payment method are all still there when they come forward
again.

That is deliberately not the same gesture as dragging the sheet away, which
throws the booking out and puts the rider back on the map.

Once the ride is created the sheet is no longer a sequence of steps — it is a
trip somebody is on — and the back button goes away.

---

## The live route and the ETA

The road on the map is drawn by **updating** the layers that are already
there, never by taking them off and putting them back. Removing and
re-adding them is what made the road strobe on a moving vehicle — it was
redrawn every fifteen seconds, or as soon as the vehicle had moved forty
metres.

The router measures the road as it draws it, so **the time it takes comes
back with it**. There is no extra request for an estimate:

```ts
const { distanceMeters, durationSeconds } = await getRoute(from, to);
```

The duration is the time the road takes at its own speed profile — the public
router has no live traffic — so it is always said as *"about 4 min"* and never
as a promise. It appears on the rider's panel, on the driver's current ride,
and on every open request in the driver's queue, which is measured with the
router's **table** service: one request for the whole queue, not one for each
request in it.

A request that has not been measured shows no time, rather than a made-up one.

---

## Testing

```bash
npm test
```

The suite covers the auth helpers, the cross-role access rules, the projection
guarantees, the fare table, the road distance and its cache, the ride
invariants, the payment sandbox and the session purge. It runs against an
in-memory Convex, so no deployment is needed. The router is stubbed, so no
test touches the network.

---

## Project layout

```
convex/            Backend functions
  lib/withAuth.ts    Session resolution and access gates
  lib/projections.ts Role-scoped response shapes
  lib/approval.ts    Driver approval states
  lib/imageType.ts   PNG/JPEG detection from file bytes
  lib/fare.ts        Fare table
  lib/routing.ts     Road distance: the router, and the fallback estimate
  lib/payments.ts    Payment provider seam (GCash sandbox)
  lib/password.ts    PBKDF2 hashing, with legacy migration
  lib/legacyAccess.ts Compatibility shim for older APKs (temporary)
  lib/legacyClients.ts Compatibility shim for older APKs (temporary)
  documents.ts     Driver credential uploads and review
  rideBooking.ts    The write behind a booking, and the check that gates it
  routeCache.ts     The remembered road distance
  routeDistances.ts Measuring the road distance, with the router
  crons.ts           Session and login-attempt purges
src/app/           Routes
  map/               Passenger map, plus the extracted panels
  operator/          Driver dashboard, map, profile and application
  admin/             Operations dashboard
src/components/    Shared UI
  admin/             Metric disclosures and their detail panels
  documents/         Credential capture sheet and upload tiles
src/lib/           Auth, theme, map and toast helpers
tests/convex/      Convex unit tests
```

### Design documents

| Document | What it covers |
|---|---|
| [`docs/pre-booking-payment-modality-plan.md`](docs/pre-booking-payment-modality-plan.md) | Choosing the payment method when the ride is booked, and the compatibility window for the Android builds already on phones |
| [`docs/booking-back-button-plan.md`](docs/booking-back-button-plan.md) | The way back through the booking sheet, without losing the pickup, the vehicle or the payment method |
| [`docs/live-route-and-eta-plan.md`](docs/live-route-and-eta-plan.md) | The live road without the strobe, the time it takes, and the driver's panels |
| [`docs/single-ride-type-plan.md`](docs/single-ride-type-plan.md) | One ride type, and the place search that had never worked |
| [`docs/mobile-packaging-plan.md`](docs/mobile-packaging-plan.md) | Building and signing the Android package |
| [`docs/admin-dashboard-plan.md`](docs/admin-dashboard-plan.md) | Admin panel information architecture, metric drill-downs, driver approval workflow |
| [`docs/operator-document-upload-plan.md`](docs/operator-document-upload-plan.md) | Driver credential upload: camera capture, storage, and the review flow |
| [`docs/logout-confirmation-plan.md`](docs/logout-confirmation-plan.md) | Where signing out lives, and the confirmation dialog that guards it |
| [`docs/map-dark-light-mode-plan.md`](docs/map-dark-light-mode-plan.md) | Theme system and map style switching |
| [`docs/color-contrast-plan.md`](docs/color-contrast-plan.md) | Light/dark contrast audit |

---

## Security notes

- Seeding, session purges and the payment recording live behind
  `internalMutation` and cannot be called from a client.
- The session token is not mirrored into a cookie. A cookie written from
  JavaScript can never be `HttpOnly`, so it would only widen the attack
  surface.
- Rate limiting, lockouts and session revocation all live server-side.
- There is a test that fails if a default password is ever committed again.
