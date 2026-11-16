# UI Refurbish — The App Shell, the Drawer, and the Dashboard

**Log ID:** `fixoct36`
**Created:** 2026-10-28 21:10 PST (Wednesday)
**Status:** ✅ Executed — all four waves complete
**Related log:** [`FIXOCT36.md`](../FIXOCT36.md) at the repository root
**Previous:** [`docs/signup-otp-plan.md`](signup-otp-plan.md) (`fixoct34`), [`docs/ride-completion-and-mobile-location-plan.md`](ride-completion-and-mobile-location-plan.md) (`fixoct34`)

---

## Overview

Today, signing in drops a commuter straight onto the map, and the map owns the
whole screen. There is no landing page for a signed-in user, no single place to
navigate from, and no dashboard.

This refurbish gives the app a **shell**: a collapsible drawer on the left that
carries the navigation and a dashboard, and a main screen that shows whatever
the user has selected.

```
┌──────────────────────────────────────────────────────────┐
│ ☰  ┌────────────────┐                                    │
│    │ HATUD          │  Dashboard                         │
│    │ ─ metrics ─    │  ┌──────────┐ ┌──────────┐          │
│    │ ─ overview ─   │  │ trips    │ │ spent    │          │
│    │ ─ theme ─      │  └──────────┘ └──────────┘          │
│    │                │  ┌────────────────────────────┐    │
│    │ Book a ride    │  │ next action / recent trip │    │
│    │ My profile     │  └────────────────────────────┘    │
│    │ Settings       │                                    │
│    │ Help           │                                    │
│    └────────────────┘                                    │
└──────────────────────────────────────────────────────────┘
```

**Mobile first.** The drawer is off-screen until the burger is tapped, and the
main screen takes the whole width.

**Everything that works today keeps working.** The signup page is untouched.
The map keeps its full-screen layout, its bottom bar and its booking sheet.

---

## What exists today

| Route | What it is | Chrome |
|---|---|---|
| `/` | Marketing page (public) | Global header hidden |
| `/login`, `/signup` | Public | Global header hidden |
| `/map` | The commuter map — full screen | Own overlays: a bottom bar on mobile, a card top-left on desktop |
| `/operator/map` | The operator map — full screen | Own floating `OperatorHeader` |
| `/profile` | Commuter profile — four tabs: profile, history, payment, settings | Global header |
| `/operator/profile` | Operator profile | Global header |
| `/payment`, `/feedback` | Transaction screens | Global header |
| `/admin` | Admin dashboard | Global header |

`ROLE_HOME` sends a commuter to `/map` and a driver to `/operator/map`. The
global header is hidden on the map screens, which have their own.

### What does not exist yet

| Missing | Where it has to go |
|---|---|
| **Change password** | There is no mutation for it at all. `auth.ts` has `signup`, `login`, `logout`, `getSession` and the OTP pair — nothing that changes a password. |
| **Real permissions** | The profile's "Notifications" is a `useState` toggle that goes nowhere. Nothing reads the location or camera permission. |
| **Help and FAQ** | The profile's "Help & Support" is a toast that says *"coming soon."* |
| **A dashboard** | The admin has one. Commuters and drivers have nothing. |
| **Any navigation model** | The header has three links, hard-coded per route. The map has its own. The profile has tabs. |

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| The drawer | A **global overlay** driven by the route, not a separate section state | The maps are full-screen routes with carefully tuned floating chrome. Turning them into components inside a shell would mean rebuilding their layout for no gain. |
| Where the drawer opens from | A **global floating burger**, top-left, with the pages' own top-left chrome shifted right | One button in one place, so it can never be missing on a surface |
| Where a signed-in user lands | `/dashboard` | The brief: not straight to the map. |
| The admin | Left on `/admin` | The admin already has a metrics dashboard. Changing it is not part of this. |
| The signup page | Untouched | As asked. |
| The theme | Every new surface uses the existing `--background`, `--surface`, `--border`, `--text-muted`, `--accent` tokens | "Stick with the theme" |
| The map's own bottom bar | Kept | It is the passenger's quick route to their profile and the theme toggle, and the booking sheet reserves 85 px for it |

---

## The drawer's contents, top to bottom

### 1. HATUD — the dynamic dashboard

The wordmark is the first thing in the drawer, and it is not a dead label: it
carries the user's own numbers.

**A commuter's dashboard** — from `profile.commuterProfile`:

| Metric | Where it comes from |
|---|---|
| Trips taken | `completedRides` |
| Total spent | `totalSpent` |
| Average rating given | derived from `history` |
| Saved places | `savedLocations.length` |
| Member since | `memberSince` |

**A driver's dashboard** — from `profile.operatorProfile`:

| Metric | Where it comes from |
|---|---|
| Trips taken | `completedRides` |
| Total earnings | `totalEarnings` |
| Average rating received | `averageRating` and `ratingCount` |
| Shift status | `isAvailable` |

**Quick actions**, in both: light/dark mode (`ThemeToggle`), and a link to the
profile.

### 2. Book a ride — commuters

Links to `/map`. The map's own booking sheet is unchanged.

### 3. See available rides — drivers

Links to `/operator/map`. The ride queue and the detail sheet are unchanged.

### 4. My profile

Links to `/profile` (or `/operator/profile`). The profile keeps its existing
tabs — **personal information**, **ride history**, **payments** — and gains:

- **Change password**, as a real feature: a new `auth.changePassword` mutation
  that takes the current password, checks it, and writes the new one. The
  current password is verified with the existing `verifyPassword`, and the new
  one goes through the same `hashPassword`.

### 5. Settings

Links to `/settings`, a new page. The profile's settings tab currently holds a
notifications toggle, a location toggle, a camera toggle and four stub buttons
(*Delete Account*, *Privacy Policy*, *Terms of Service*, *Help & Support*).

The new page turns the three toggles into **real permission state**:

| Permission | How it is read | How it is requested |
|---|---|---|
| Notifications | `Notification.permission` | `Notification.requestPermission()` |
| Location | `navigator.permissions.query({ name: "geolocation" })` | A single `getCurrentPosition`, which raises the native dialog on Android |
| Camera | `navigator.permissions.query({ name: "camera" })` | The same shape as the document capture sheet |

Each shows its real state — granted, denied, or not yet asked — and a button to
ask for it. Where the browser has no Permissions API, the state is shown as
*"unknown"* rather than a lie.

The four stub buttons move here, and two of them stop being stubs:

- *Terms of Service* → opens the terms dialog, which already exists.
- *Help & Support* → opens the new help page.
- *Delete Account* and *Privacy Policy* stay as they are — they are outside the
  scope of this refurbish, and the privacy policy needs writing.

### 6. Help

Links to `/help`, a new page with:

- **Getting started** — how to book, how to accept, how to pay.
- **The map** — the coloured route, the two legs, why a driver may be offline.
- **Your account** — the terms, changing your password, the application review.
- **Payments** — GCash in the sandbox, what a fare is made of.
- **FAQs** — written from the actual behaviour of the app.

---

## The landing page

A signed-in user lands on `/dashboard`, which has the drawer on the left and
**three containers** in the main area:

| Container | What it holds |
|---|---|
| **The metrics row** | Two or three metric cards: trips, money, rating. |
| **The next action** | What to do next — the trip that needs paying for or rating, the queue of open requests for a driver, or a short "you are all set" when there is nothing. |
| **Recent activity** | The last three trips, or the latest requests. |

The drawer is the fourth container, and it is always there.

---

## Layout and spacing — the part that has to be got right

The failure mode is a burger button sitting on top of a card. The rules:

| Rule | Why |
|---|---|
| The burger is **fixed**, top-left, with `env(safe-area-inset-top)` | One position, every surface, never scrolled away |
| The burger is **48 × 48** with a 12 px inset | A comfortable tap target that clears the notch |
| The drawer is **280 px** wide, or `min(85vw, 320px)` | Wide enough for the dashboard, narrow enough to leave the content visible |
| The drawer's backdrop is `bg-black/50` and it closes on the backdrop | Tapping outside closes it — the expected behaviour on a phone |
| The drawer stays **mounted** and moves, rather than being mounted and unmounted | A drawer that is unmounted cannot animate out |
| The drawer is `inert` while it is closed | Nothing behind it can be focused or reached with a tap |
| Moving between screens plays a **420 ms** loading beat | Long enough to read as a transition, short enough to feel quick |
| The drawer **scrolls** on its own | The dashboard plus six items is taller than a small phone |
| The pages' own top-left chrome shifts **right by 60 px** on large screens | The burger and the card never overlap |
| The drawer is `z-[60]`, below toasts (`z-[100]`) | A toast is never hidden behind the drawer |
| The map's bottom bar keeps its **85 px** | The booking sheet still clears it |
| The drawer is **never rendered** on `/`, `/login` or `/signup` | The public pages keep their own layout |

---

## Work Breakdown

### Wave 1 — The shell and the drawer ✅

| # | Task | File |
|---|---|---|
| 1.1 | The drawer: the dashboard head, the navigation, the quick actions | `src/components/AppDrawer.tsx` (new) |
| 1.2 | The floating burger, and the context that opens and closes it | `src/components/AppShell.tsx` (new) |
| 1.3 | The drawer mounted for signed-in users, and the burger placed | `src/app/layout.tsx`, `src/app/map/MapOverlays.tsx`, `src/app/operator/map/page.tsx` |
| 1.4 | A signed-in user lands on the dashboard | `src/lib/roles.ts` |

### Wave 2 — The new pages ✅

| # | Task | File |
|---|---|---|
| 2.1 | The dashboard: the metrics, the next action, the recent activity | `src/app/dashboard/page.tsx` (new) |
| 2.2 | The settings page, with the real permission state | `src/app/settings/page.tsx` (new) |
| 2.3 | The help page and its FAQs | `src/app/help/page.tsx` (new) |
| 2.4 | The help and FAQ content | `src/lib/help.ts` (new) |

### Wave 3 — The profile ✅

| # | Task | File |
|---|---|---|
| 3.1 | Change password, as a real mutation | `convex/auth.ts` |
| 3.2 | The change-password form on the profile | `src/app/profile/page.tsx`, `src/app/operator/profile/page.tsx` |
| 3.3 | The old settings tab points at the new page | `src/app/profile/page.tsx` |

### Wave 4 — Verification ✅

| # | Task | File |
|---|---|---|
| 4.1 | The drawer opens, closes and navigates | `tests/appShell.test.ts` (new) |
| 4.2 | A password can be changed, and the old one is required | `tests/convex/auth.test.ts` (new) |
| 4.3 | The drawer is never on the public pages | `tests/appShell.test.ts` |
| 4.4 | The verification run, and the Android rebuild | — |

---

## Test Plan

| # | Assertion |
|---|---|
| T1 | A signed-in commuter lands on the dashboard, not the map. |
| T2 | A signed-in driver lands on the dashboard, not the ride queue. |
| T3 | The admin still lands on the admin dashboard. |
| T4 | The drawer is not rendered on `/`, `/login` or `/signup`. |
| T5 | The drawer shows the dashboard, the role's rides link, the profile, the settings and the help. |
| T6 | The drawer shows the commuter's metrics and the driver's metrics. |
| T7 | Changing a password needs the current one, and the old one is refused. |
| T8 | Changing a password writes the new hash and leaves the session alone. |
| T9 | The settings page shows the real state of the three permissions. |
| T10 | The help page has a FAQ for every section of the drawer. |

---

## Verification

```bash
npm run typecheck        # tsc --noEmit
npm run check            # ultracite check
npm test                 # vitest run
npm run build            # next build
npm run mobile:build     # next build && cap sync
```

**Baseline before the work:** `tsc` 0 errors · `ultracite check` 0 errors · 190
tests passing · `next build` OK.

**After:** `tsc` 0 errors · `ultracite check` 0 errors · **207** tests passing
(190 + 17 new) · `next build` OK — 17 static routes · `npm run mobile:build` OK.

### The decisions that were taken

| Question | Answer |
|---|---|
| Does the admin get the drawer? | **Yes.** The drawer head carries their metrics, and their second entry is *Operations*. |
| Where does a signed-in user land? | **Always `/dashboard`**, for every role. The map is one tap away. |
| Change password for a driver? | **The same form on both profiles**, sharing one mutation. |
| The permission toggles? | **The real state, with a way to ask for it.** |

### After the refurbish: the animation, the beat, and the trip that was not there

The drawer now slides in and out rather than appearing, and moving between
screens plays a short HATUD loading beat.

The map was also changed: it now only greets a passenger with a trip they have
**just** finished, rather than with the newest finished trip however old it was.
A trip records when it ended (`rides.completedAt`), the map carries a trip from
the last thirty minutes, and everything else moves to the dashboard, where the
things waiting for you belong. See [`FIXOCT37.md`](../FIXOCT37.md).

### One thing the build caught

The global header carries the menu button, so it has to be inside the shell that
owns the drawer. It was not, and every page with a header threw
*"useAppShell must be used inside the app shell"* during the static export. The
layout was fixed, and a test now asserts the header is inside the shell so it
cannot come back.

### On a device

1. Sign in → the **dashboard**, not the map.
2. The burger is at the top-left. Tap it → the drawer slides in with the
   dashboard head, the navigation and the quick actions.
3. Tap *Book a ride* → the map, exactly as it is today.
4. Tap *My profile* → the profile, with **Change password** added.
5. Tap *Settings* → the three permissions with their real state.
6. Tap *Help* → the help and the FAQs.
7. Nothing overlaps the burger, on any screen.

---

## Risk

| Risk | Mitigation |
|---|---|
| The burger lands on top of existing chrome | The drawer is a fixed overlay with one position; the pages' own top-left chrome shifts right by 60 px. |
| The map's booking sheet ends up under the drawer | The drawer is `z-[60]` and the booking sheet is `z-[40]`; the drawer closes on navigation. |
| A driver or commuter loses a way into the map | Both roles have an explicit drawer entry, and the map keeps its own bottom bar and profile link. |
| The Permissions API is missing in the Android WebView | Every lookup falls back to *"unknown"* and the request still goes through `getCurrentPosition`, which raises the native dialog. |
| The change password is not applied to existing sessions | The password is changed in place and the session is left alone, so nothing signs the user out unexpectedly. |
| The dashboard is slow | It reads the two profile queries the profile page already reads, and they are already cached by Convex. |
| The refurbish breaks the existing flows | Nothing is removed. The profile's tabs, the map, the queue and the payment flow are all untouched. |
