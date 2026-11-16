# HATUD: Tech Stack, Architecture and Specifications

| | |
|---|---|
| **Document** | Tech stack, system architecture and specifications |
| **Project** | HATUD, a ride-hailing app for commuters and drivers in Antique, Philippines |
| **Version** | 1.0 |
| **Last updated** | 2026-11-05 |
| **Status** | Current as of the working tree on `main` (app version 0.1.0) |
| **Sources** | `package.json`, `convex/schema.ts`, `convex/crons.ts`, `convex/lib/*`, `next.config.ts`, `capacitor.config.ts`, `README.md` |

## Contents

1. [Overview](#1-overview)
2. [Tech stack](#2-tech-stack)
3. [System architecture](#3-system-architecture)
4. [Specifications](#4-specifications)
5. [Open items](#5-open-items)
6. [Change log](#6-change-log)

---

## 1. Overview

HATUD lets passengers (commuters) book a ride, lets drivers (operators) accept it, and settles the fare by GCash, Maya or cash. The app is a Next.js static export bundled for Android with Capacitor. It talks to a Convex backend.

## 2. Tech stack

| Layer | Technology | Version |
|---|---|---|
| Front end | Next.js (App Router), React, TypeScript, Tailwind CSS | 16.1.7, 19.2.3, 5, 4 |
| Maps | MapLibre GL with OpenFreeMap tiles (bright and dark styles) | 5.x |
| Routing and geocoding | OSRM public router, Nominatim (OpenStreetMap) | hosted |
| Backend | Convex: reactive database, queries, mutations, actions, cron jobs, file storage | 1.37 |
| Mobile | Capacitor (Android, app id `com.hatud.app`), Gradle build | 8.4 |
| Env validation | `@t3-oss/env-nextjs` | 0.13 |
| Testing | Vitest, `convex-test`, `@edge-runtime/vm`, Playwright | 4.1, 0.0.62, 5.0, 1.64 |
| Lint and format | Ultracite on Biome | 7.6, 2.4 |
| Side service (legacy) | `flask_api/`: Flask, Flask-JWT-Extended, Flask-CORS (Python) | 3.1.1, 4.7.1, 6.0.0 |

> **Note:** the Flask service was not inspected in detail. It appears to be an older or separate prototype with auth, data and aggregation routes. Nothing in the Convex or Next.js code uses it.

## 3. System architecture

### 3.1 Component diagram

```
┌──────────────────────────────┐        ┌──────────────────────────────────┐
│ Android APK (Capacitor)      │        │ Convex backend                   │
│  └ Next.js static export     │ ─────▶ │  queries / mutations / actions   │
│    (React 19 + MapLibre)     │ ◀───── │  reactive DB + file storage      │
│  session token in            │  live  │  crons (housekeeping)            │
│  localStorage                │  subs  │  internal mutations (seed/repair)│
└──────────────┬───────────────┘        └───────────────┬──────────────────┘
               │                                        │ actions call out to
               ▼                                        ▼
     OpenFreeMap tiles, OSRM,               OSRM (fare distance), payment
     Nominatim                              provider seam, email provider seam
```

### 3.2 Client-heavy, serverless design

- Next.js is built with `output: "export"`, and Capacitor bundles the output (`out/`) into the APK. There is no Next.js server at runtime.
- The browser talks directly to Convex. Live subscriptions drive real-time ride state, chat and location sharing.

### 3.3 Authentication and sessions

- Source: `convex/lib/withAuth.ts`, `convex/lib/password.ts`.
- A session token is kept in `localStorage` and sent explicitly on every call.
- The server resolves the token into an `Actor` (user id, role, role-profile id). Clients never send a user id for authorisation.
- Failed logins are tracked in `loginAttempts` with a lockout.
- Sign-up verifies the email with a one-time code held in `signupCodes`. The code and password are stored hashed, and verifying and creating the account is one transaction.
- Roles: `commuter`, `operator`, `admin`.

### 3.4 Intent-scoped access model

- Queries are named for who may call them, for example `commuters.getSelf`, `operators.getForRide`, `rides.getActiveForMe` and `adminQueries.*`.
- Responses are projected (`convex/lib/projections.ts`). A commuter never receives a driver's licence number or live position, and a driver never receives a commuter's email or saved addresses.
- Generic by-id lookups (`getById`, `getByEmail`, `listByRole`) were removed.

### 3.5 External-service seams

| Seam | File | Current implementation |
|---|---|---|
| `PaymentProvider` | `convex/lib/payments.ts` | GCash and Maya sandboxes. No money moves. Test numbers `09179000000` (GCash) and `09179000001` (Maya) always decline. |
| `EmailProvider` | `convex/lib/email.ts` | Console provider (writes to the server log). |

A real gateway or mail service replaces an implementation without touching the flows that call it.

### 3.6 Server-authoritative business logic

- **Fare:** computed on the server from the OSRM road distance and locked in at booking. The client sends no amount. The distance is cached in `routeDistances`, so the quote and the booking read the same row. If the router is unreachable, it falls back to a straight-line estimate × 1.18.
- **Booking and quoting** are Convex actions, because a mutation cannot make network calls. The write is an internal mutation (`convex/rideBooking.ts`).
- **Ride state machine** (`convex/lib/rideState.ts`): the single source of truth for legal status transitions.
- **Arrival rule** (`convex/lib/arrival.ts`): refuses a passenger's confirmation while the driver is demonstrably still far away. A missing or stale driver position is not judged.
- **Payment method:** chosen at booking and read from the ride, never from the request.
- **Cash rides:** settled when the driver confirms the handover, in the same transaction that closes the ride.

### 3.7 Ride lifecycle

```
pending ──(operator accepts)──▶ accepted ──(commuter confirms)──▶ inProgress ──(operator completes)──▶ completed
   │                               │
   └──────────── cancelled ◀───────┘   (terminal, as is completed)
```

### 3.8 Background jobs

Source: `convex/crons.ts`.

| Job | Interval | Effect |
|---|---|---|
| Purge expired sessions | 24 h | Deletes revoked or expired sessions |
| Purge stale login attempts | 24 h | Deletes records older than 24 h or with an expired lock |
| Expire stale pending rides | 5 min | Cancels requests unclaimed for 15 min |
| Expire rides nobody confirmed | 5 min | Cancels accepted rides unconfirmed for 30 min |

### 3.9 Compatibility window

`convex/lib/legacyClients.ts` keeps APKs built before `fixoct38` working. Those builds cannot send a payment method, start the trip with the driver's own tap, or confirm cash. The file is designed to be deleted in one step once the fleet has migrated. Its header carries the checklist. `tests/legacyApk.test.ts` checks that every Convex function the shipped APK calls still exists on the server.

## 4. Specifications

### 4.1 Data model

11 Convex tables, defined in `convex/schema.ts`.

| Group | Table | Purpose |
|---|---|---|
| Accounts | `users` | Credentials, role, theme, terms acceptance, email verification |
| | `commuters` | Passenger profile and saved locations |
| | `operators` | Driver profile, vehicle info, availability, approval status, live location |
| | `admins` | Admin profile and permissions |
| Ride flow | `rides` | Pickup and dropoff, status, fare, distance, payment method and status, live locations |
| | `payments` | Settlement records (PHP) |
| | `feedback` | Ratings and comments per ride |
| | `messages` | In-ride chat |
| Supporting | `operatorDocuments` | Licence, registration, official receipt and insurance uploads |
| | `routeDistances` | Cached road distances used for fares |
| | `signupCodes` | Pending sign-ups awaiting their one-time code |
| | `sessions`, `loginAttempts` | Auth state |

### 4.2 Tariff

There is one ride type, Standard.

| Base | Included | Per started km beyond |
|---|---|---|
| ₱30 | 2 km | ₱12 |

### 4.3 Payments

| Method | Money moves | Settled by |
|---|---|---|
| GCash | After the trip | Rider, on `/payment` |
| Maya | After the trip | Rider, on `/payment` |
| Cash | At drop-off | Driver, by confirming the handover |

- Currency: PHP.
- Payment statuses: `PENDING`, `AUTHORIZED`, `SETTLED`, `FAILED`, `EXPIRED`, `REFUNDED`.
- Ride payment statuses: `unpaid`, `pending`, `paid`, `failed`.

### 4.4 Features by role

| Role | Capabilities |
|---|---|
| Commuter | Book a ride with pickup and dropoff, see the route and live driver position, chat, pay, rate the driver, save locations |
| Operator | Go online or offline, accept requests, share live location, upload credential documents (with camera capture), complete rides, confirm cash collection. Applications go through admin approval: pending, approved or rejected, with a note |
| Admin | Dashboard of metrics (each expandable), operator approval |

### 4.5 Frontend routes

Under `src/app`: `/`, `/login`, `/signup`, `/map`, `/payment`, `/feedback`, `/profile`, `/settings`, `/help`, `/dashboard`, `/admin`, `/operator`, `/operator/map`, `/operator/profile`.

### 4.6 Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Static export into `out/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` / `check:write` | Ultracite lint and format check / auto-fix |
| `npm test` / `test:watch` | Vitest (convex-test) |
| `npm run mobile:build` | Build and `cap sync` |
| `npm run mobile:apk` | Build, sync and `gradlew assembleDebug` (needs JDK 21 and the Android SDK) |
| `npm run mobile:android` | Build, sync and open Android Studio |

### 4.7 Testing

- Convex function tests in `tests/convex/` (authorisation, rides).
- APK compatibility test in `tests/legacyApk.test.ts`.

### 4.8 Conventions

- Ultracite/Biome formatting.
- Convex rules in `convex/_generated/ai/guidelines.md`.
- Doc-comments explain the reason for each decision.

## 5. Open items

| # | Item | Notes |
|---|---|---|
| 1 | Flask API role | Confirm whether `flask_api/` is still used or can be archived |
| 2 | Payment gateways | GCash and Maya are sandboxes. Real integrations are still to do |
| 3 | Email delivery | Console provider only. A real mail service is needed for production OTP |
| 4 | Legacy client shim | Remove `legacyClients.ts` once the fleet is on the new APK (checklist in the file header) |
| 5 | Public OSRM and Nominatim | Public instances have usage limits. `docs/own-router-plan.md` covers self-hosting |

## 6. Change log

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-11-05 | 1.0 | Initial document: tech stack, architecture and specifications, derived from the codebase | Claude, for Daniel Estaris |
