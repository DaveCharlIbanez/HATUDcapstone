# Admin Dashboard Redesign — Implementation Plan

## Overview

The admin panel at `/admin` is the operations cockpit for HATUD. Today it shows
four numbers that do nothing when tapped, three fake "coming soon" buttons, a
hard-coded dropout table, and an approval queue whose buttons only print a
toast. This document defines the target design and the data it is built on, so
the implementation has one source of truth.

The headline change: **every metric is a disclosure**. Tapping a metric opens
a panel underneath it listing the actual records behind that number — the
drivers who are online, the trips that are live, the riders on the platform —
without navigating away to another screen.

## Problem Statement

### Broken today

| Problem | Detail |
|---|---|
| Metric cards are dead | `cursor-pointer` but no `onClick`. The four headline numbers (Active Drivers, Pending Approvals, Live Trips, Popular Drivers) cannot be inspected. |
| "Popular Drivers" is not a metric | It returns `popularOperators.length`, which is `min(operators, 10)`. It counts nothing meaningful. |
| "Pending Approvals" is not pending | `getPendingDrivers` returns **every** operator, approved or not. The list header says "pending". |
| Approve / Reject do nothing | Both handlers only call `showToast`. There is no approval field on the schema, so there is nothing to approve. |
| Dropout analysis is fabricated | Five hard-coded reasons with fixed percentages and counts. None of it is measured. |
| "View Live Trip Map" leads nowhere | It pushes `/map`, which `RouteGuard` restricts to the commuter role, so an admin is bounced straight back to `/admin`. |
| Three "Open" cards do nothing | Review Requests / Manage Accounts / View Reports — two are fake toasts, the third toggles a section far above the fold. |
| No theme switch | The admin page is the only authenticated page with no `ThemeToggle` or `ThemeSlider`. |
| No rider view at all | The panel cannot show the commuter side of the platform. |

### Mobile today

The four metric cards stack one per row on a phone, each roughly 200px tall
with a 4xl number and a "Updated just now" line. That is most of the first
screen before any control is reachable, and none of it is actionable. The three
accordion sections and the three "Open" cards push the real work — approving a
driver — to the very bottom.

## Goals

1. Every metric expands in place to show the records behind it. No new tab, no
   navigation.
2. The panel is designed mobile-first and is usable one-handed on a phone.
3. Everything on the panel is real data measured from the database.
4. The visual language matches the rest of the app in both light and dark
   theme.
5. The primary admin action — approving a driver — actually works and is
   reachable within one tap of loading the page.

### Non-goals

- A live map for admins (a third MapLibre instance). Out of scope for this
  iteration; live positions are shown as coordinates in the Live Trips panel.
- Editing rider/operator profile fields beyond approval status.
- Charts beyond simple proportional bars.

## Design Language

The admin panel must not invent its own visual language. It reuses the tokens
and patterns already used across `/profile`, `/operator/profile` and
`/operator/map`.

### Tokens

| Token | Usage |
|---|---|
| `bg-[var(--background)]` | Page background |
| `bg-[var(--surface)]` | Card background |
| `bg-[var(--surface-strong)]` | Nested row background inside a card |
| `bg-[var(--surface-muted)]` | Icon chip, progress track |
| `border-[var(--border)]` | Every card and row border |
| `text-[var(--foreground)]` | Primary text — **never** hard-coded `text-white` |
| `text-[var(--text-muted)]` | Secondary text, labels, timestamps |
| `text-sky-500 dark:text-sky-400` | Accent — icon chips, active states |

No hard-coded `text-white` on a surface. The light theme sets
`--background: #ffffff` and `--surface: #f8fafc`, so white text on either is
invisible. `text-[var(--foreground)]` resolves to `#0f172a` in light and
`#f8fafc` in dark, which is the only correct way to write body text here.

### Shapes and elevation

- Cards: `rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm`
- Icon chips: `flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-strong)]`
- Detail rows: `rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]`
- Buttons: `rounded-full`, `btn`/`btn-primary`/`btn-secondary` from
  `globals.css`, or a solid `bg-sky-600` for the single primary action.
- No `text-white` except on a saturated `bg-sky-600` / `bg-emerald-600` /
  `bg-rose-600` fill, where it is a label on a colour, not body text.

## Information Architecture

The page is a single vertical stack of **metric disclosures**. A disclosure is
a row (the metric) that expands to a panel (the records). Only one disclosure
is open at a time — on a phone, two open panels would push the rest of the
page off screen.

```
┌ Header ───────────────────────────────┐
│ ADMIN PANEL            [theme] [out]  │
│ Hatud Operations                       │
└────────────────────────────────────────┘
┌ Active Drivers              2      ⌄ ──┐   ← tap to expand
│ 🛵  Available right now                  │
│   ┌──────────────────────────────────┐  │
│   │ Roberto Reyes      ● Online       │  │
│   │ ABC 123 · Yamaha NMAX 155        │  │
│   │ ⭐ 5.0 (2 ratings)   10.5944, …  │  │
│   └──────────────────────────────────┘  │
└────────────────────────────────────────┘
┌ Live Trips                3      ⌄ ──┐
┌ Registered Riders          12     ⌄ ──┐
┌ Driver Approvals          1      ⌄ ──┐   ← Approve / Reject live here
┌ Completed Trips            47     ⌄ ──┐
┌ Revenue (GCash)      ₱12,480      ⌄ ──┐
┌ Ratings & Feedback        18     ⌄ ──┐
┌ Cancellation Analysis      5     ⌄ ──┐
└────────────────────────────────────────┘
```

### The disclosures

| Disclosure | Metric shown | Panel contents |
|---|---|---|
| **Active Drivers** | Operators with `isAvailable: true` | Name, vehicle + plate, licence, average rating and rating count, last known coordinates, online/offline pill |
| **Live Trips** | Rides with status `accepted` or `inProgress` | Rider name, driver name, status pill, fare, pickup → dropoff, driver and rider last known coordinates |
| **Registered Riders** | All commuters | Name, email, phone, rides taken, total spend, joined date |
| **Driver Approvals** | Operators whose `approvalStatus` is `pending` | Full application card: name, email, phone, licence, vehicle + plate + colour, joined date, **Approve** / **Reject** buttons |
| **Completed Trips** | Rides with status `completed` | Rider, driver, fare, route, completed date |
| **Revenue (GCash)** | Settled payments | Amount, reference number, rider, paid date |
| **Ratings & Feedback** | Feedback rows, newest first | Stars, comment, rider, driver, date |
| **Cancellation Analysis** | Cancelled rides | Cancelled vs completed counts, cancellation rate, per-vehicle-type breakdown bars, average wait before cancelling |

## Component Spec

### MetricDisclosure

A `<button>` that owns the header and the expanded panel.

- **Header (collapsed)** — full-width tap target, `min-h-[4.5rem]`, `flex
  items-center justify-between gap-4`, `text-left`.
  - Left: icon chip (44×44, `rounded-2xl`) + label (`text-[var(--foreground)]
    font-semibold`) + hint line (`text-[var(--text-muted)] text-sm`).
  - Right: the value. `text-2xl font-semibold` for counts, `text-xl` for the
    peso figure. Then a chevron that rotates `180°` when open and a
    `sr-only` "Show"/"Hide" label so screen readers announce the state.
- **Header (expanded)** — same row, accent left border (`border-l-4
  border-sky-500`) so it is obvious which panel is open.
- **Panel** — `mt-4 space-y-3`, contains the rows for that metric.
- Accessibility: `aria-expanded={isOpen}` and `aria-controls={panelId}` on the
  button, `id={panelId}` on the panel.

### Detail row

```
┌─────────────────────────────────────────┐
│ Roberto Reyes            [● Online]     │
│ ABC 123 · Yamaha NMAX 155 · DR-2024-001│
│ ⭐ 5.0 (2 ratings)   10.5944, 121.9494  │
└─────────────────────────────────────────┘
```

- `rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4`
- Title line: `flex items-center justify-between gap-3`, name in
  `text-[var(--foreground)] font-semibold text-sm`.
- Meta line: `text-[var(--text-muted)] text-sm`, `flex flex-wrap gap-x-2` so it
  wraps instead of overflowing on a narrow phone.
- Status pill: `rounded-full px-2.5 py-0.5 text-xs font-semibold` over a
  20%-alpha tint of the same hue.

### Empty state

Never leave a panel blank. `py-6 text-center text-[var(--text-muted)]` with a
one-line explanation ("No drivers are online right now.").

### Skeleton

While the dashboard query is in flight, each disclosure header shows `—` for
the value and the panel shows three pulsing placeholder rows
(`animate-pulse bg-[var(--surface-muted)]`).

## Mobile-First Rules

1. **One column.** Every layout is single-column by default. Multi-column
   grids are opt-in at `sm:` or `md:`.
2. **Tap targets ≥ 44px.** Metric headers, action buttons and list rows are
   all at least 44px tall.
3. **The header stacks.** Title block first, actions below on a phone
   (`flex-col sm:flex-row`), actions right-aligned from `sm:` up.
4. **Numbers wrap.** Values use `text-2xl` on mobile and `text-3xl` from
   `sm:` so a large figure never forces horizontal scroll.
5. **Meta text wraps.** Detail meta lines use `flex-wrap` with `gap-x-2`.
6. **One disclosure open at a time.** Keeps the page height predictable and
   prevents a phone user from losing their place.
7. **Primary action first.** "Driver Approvals" is the second disclosure, so
   the approve/reject action is one tap away — not below three other sections.
8. **No horizontal scrolling.** No fixed widths, no `whitespace-nowrap` on
   content, no tables. Lists are stacked cards.

## Data Model Change

### `operators.approvalStatus`

```
approvalStatus: v.optional(v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
)),
```

- The field is **optional**, so the change is non-breaking: existing documents
  stay valid and need no backfill.
- A **missing** value means `approved`. The seeded operators (operator1,
  operator2) and every operator that existed before this change are
  approved, so nothing they can do today changes.
- New driver sign-ups are created with `approvalStatus: "pending"`. A pending
  driver cannot go online and cannot accept rides.
- Approving sets `approved`; rejecting sets `rejected`. Rejecting can be
  undone by approving later.

### Where approval is enforced

| Function | Rule |
|---|---|
| `operators.setAvailability` | Rejects with `Forbidden: your account is not approved yet` unless the operator is approved. |
| `rides.accept` | Rejects with `Forbidden: your account is not approved yet` unless the operator is approved. |

### `convex/admins.ts` → `setOperatorApproval`

A new admin-only mutation:

```
setOperatorApproval({ sessionToken, id, approvalStatus })
```

- Requires the `admin` role (`requireRole`).
- Patches the operator's `approvalStatus` and `updatedAt`.
- Approving a driver also sets `isAvailable: false` — approval means "may
  drive", not "is currently on shift". The driver goes online themselves.

## Backend

### `adminQueries.getDashboard`

One admin-scoped query returning a consistent snapshot. A single query means
the headline counts and the lists underneath them can never disagree.

Every list is bounded with `.take()` — the admin panel must never read an
unbounded collection.

```
metrics: {
  activeDrivers, approvedDrivers, pendingDrivers, pendingRejections,
  liveTrips, pendingTrips, completedTrips, cancelledTrips,
  riders, revenue, averageRating, ratingCount
}
drivers:      DriverRow[]     // all operators, 50
liveRides:   LiveRideRow[]   // accepted + inProgress, 50
riders:       RiderRow[]      // all commuters, 50
recentRides:  RideRow[]       // completed, 50
payments:     PaymentRow[]    // settled, 50
feedback:     FeedbackRow[]   // newest first, 50
cancellations: {
  cancelled, completed, rate, averageWaitMs, byVehicleType: { type, cancelled, completed }[]
}
```

Each row is a projection, not a whole document. The panel must not leak
anything the admin does not need — a driver's licence number is shown because
an admin approves licences, but the operator's password hash and the
commuter's saved home addresses are not included.

### Existing admin queries

`getMetrics`, `getPendingDrivers`, `getAllRides` and `getRecentFeedback` are
replaced by `getDashboard`. `getAllRides` returned every ride in the database
unbounded and had no caller that used the result.

## Acceptance Criteria

1. Tapping any metric header expands a panel with the records behind that
   number; tapping it again collapses it.
2. Only one panel is open at a time.
3. Every number on the page is read from the database. No hard-coded
   percentages, counts, names or reasons remain in the admin page.
4. "Driver Approvals" lists only operators with `approvalStatus: "pending"`.
5. Approve persists to the database, removes the driver from the pending list,
   and the driver's count drops by one. Reject does the same for `rejected`.
6. A pending driver cannot go online or accept a ride.
7. At 360px width there is no horizontal scroll, no clipped text and no
   tap target under 44px.
8. The page is legible in both light and dark theme; no body text is
   hard-coded white.
9. The page has a theme toggle.
10. No button on the page leads to a route the admin cannot open.

## Implementation Checklist

- [x] `convex/schema.ts` — add `approvalStatus` to `operators`
- [x] `convex/schema.ts` — add `cancelledAt` to `rides`
- [x] `convex/lib/approval.ts` — shared approval helpers
- [x] `convex/auth.ts` — new driver sign-ups start `pending`
- [x] `convex/operators.ts` — gate `setAvailability` on approval
- [x] `convex/rides.ts` — gate `accept` on approval; stamp `cancelledAt`
- [x] `convex/admins.ts` — add `setOperatorApproval`
- [x] `convex/adminQueries.ts` — replace queries with `getDashboard`
- [x] `src/app/admin/page.tsx` — rebuild as metric disclosures
- [x] `src/components/admin/MetricDisclosure.tsx` — disclosure component
- [x] `src/components/admin/DetailRow.tsx` — detail row, pill, empty state, skeleton
- [x] `src/components/admin/AdminPanels.tsx` — the eight panel bodies
- [x] `src/app/globals.css` — `.btn-secondary` uses the theme's foreground colour
- [x] `src/components/ThemeToggle.tsx` — 44px tap target
- [x] `tests/convex/admin.test.ts` — dashboard query + approval flow tests
- [x] `README.md` — link to this document

## Deviations From The Plan

- **`cancelledAt` was added to `rides`.** The plan measured "average wait
  before cancelling" from `updatedAt - createdAt`. That is wrong: `updatedAt`
  is bumped by every unrelated patch on the ride (operator assignment, live
  location writes), so the average came out at hours rather than minutes. The
  schema now carries the moment the ride was dropped, and only cancelled
  rides that carry it contribute to the average.
- **The live admin map was not built.** It was already listed as a non-goal.
  Live positions are shown as coordinates in the Live Trips panel instead.
- **`getDashboard` replaces four queries rather than extending them.**
  `getAllRides` returned every ride in the database unbounded and had no
  caller that used the result; `getMetrics`, `getPendingDrivers` and
  `getRecentFeedback` are now folded into the single snapshot.
- **`.btn-secondary` in `globals.css` was writing white text.** The light
  theme sets `--btn-secondary: #94a3b8`, so the class rendered white on a
  pale grey button and any `text-rose-*` utility on top of it was silently
  overridden. It now uses `var(--secondary-foreground)`, which is near-black
  in light theme and near-white in dark.

## Verification

Checked in a real browser against the dev deployment, at 360px and 1280px, in
both themes:

```
MOBILE:  horizontalOverflow=false (360 vs 360)   tap targets under 44px: []
DESKTOP: horizontalOverflow=false (1280 vs 1280)
DESKTOP light colours: title=rgb(15,23,42)  value=rgb(15,23,42)
one panel open at a time
PAGE_ERRORS=none
```

The approval flow, end to end in the browser:

```
approvals count before: 1
approvals count after=0
toastShown=true   stillListed=false
driver toggle before: Offline
driver toggle after: Online
```

Covered by `tests/convex/admin.test.ts`:

- the dashboard counts the fleet and lists the records behind it
- a driver with no approval status counts as approved
- a non-admin cannot read the dashboard
- approving a driver clears them from the pending list
- only an admin can approve a driver
- a pending driver cannot go online or accept a ride
- an approved driver can go online again

