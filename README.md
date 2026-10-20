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

| Vehicle | Base | Included | Per started km |
|---|---|---|---|
| Standard | ₱30 | 2 km | ₱10 |
| Priority | ₱50 | 2 km | ₱12 |

Distance is the haversine distance between the two points scaled by a
road-circuity factor of 1.3. The client sends no amount and cannot influence
the price.

### Payments

`convex/lib/payments.ts` defines a `PaymentProvider` seam. The current
implementation is a GCash **sandbox** — no money moves. The designated test
number `09179000000` always declines, so the failure path can be demonstrated.
Swapping in the real gateway means replacing that one implementation.

Charging runs as a Convex *action* (gateway calls may take time), which
prepares the charge through an internal mutation and records the outcome
through another.

---

## Mobile build

```bash
npm run mobile:build
npx cap sync android
npx cap open android
```

Then build the APK from Android Studio, or:

```bash
cd android && ./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/`.

> **After upgrading the backend**, older APKs stop working. The nine reads
> that predate session-token auth still work without a token during the
> transition — see `convex/lib/legacyAccess.ts` — but they return projected
> data only. Once the fleet has migrated, that file is deleted and the token
> becomes required on every query.

---

## Testing

```bash
npm test
```

The suite covers the auth helpers, the cross-role access rules, the projection
guarantees, the fare table, the ride invariants, the payment sandbox and the
session purge. It runs against an in-memory Convex, so no deployment is
needed.

---

## Project layout

```
convex/            Backend functions
  lib/withAuth.ts    Session resolution and access gates
  lib/projections.ts Role-scoped response shapes
  lib/fare.ts        Fare table and distance calculation
  lib/payments.ts    Payment provider seam (GCash sandbox)
  lib/password.ts    PBKDF2 hashing, with legacy migration
  lib/legacyAccess.ts Compatibility shim for older APKs (temporary)
  crons.ts           Session and login-attempt purges
src/app/           Routes
  map/               Passenger map, plus the extracted panels
  operator/          Driver dashboard, map and profile
src/components/    Shared UI
src/lib/           Auth, theme, map and toast helpers
tests/convex/      Convex unit tests
```

---

## Security notes

- Seeding, session purges and the payment recording live behind
  `internalMutation` and cannot be called from a client.
- The session token is not mirrored into a cookie. A cookie written from
  JavaScript can never be `HttpOnly`, so it would only widen the attack
  surface.
- Rate limiting, lockouts and session revocation all live server-side.
- There is a test that fails if a default password is ever committed again.
