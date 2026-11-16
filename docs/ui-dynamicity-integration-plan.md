# UI Dynamicity Integration Plan

**Date:** October 27, 2026
**Scope:** Draggable snap-sheets · landing-page gating · loading animation · brand emphasis · theme ripple
**Status:** Ready for implementation
**Executor:** opencode (agent-run, one work item at a time, logged below)

---

## 0. Label Scheme & Logging Rules

Every work item carries a stable ID of the form `UI-DYN-NN`. IDs are referenced
in commit messages, in code comments that need context, and in the Progress Log
at the end of this file.

| ID range | Subsystem | Tag |
|---|---|---|
| `UI-DYN-01` … `UI-DYN-07` | Draggable snap-sheets | `DRAG` |
| `UI-DYN-08` … `UI-DYN-09` | Landing page & navigation | `LAND` |
| `UI-DYN-10` … `UI-DYN-12` | Loading animation | `LOAD` |
| `UI-DYN-13` | Brand wordmark | `BRAND` |
| `UI-DYN-14` … `UI-DYN-15` | Theme ripple | `THEME` |

**Logging rules**

1. Update the **Progress Log** table at the end of this file at the *end of every
   work item* — not in a batch at the end of the session.
2. A work item is only marked `DONE` when its **Acceptance criteria** are
   satisfied *and* `npm run typecheck`, `npm run check` and `npm run test` all
   pass.
3. A work item that is started but not finished is marked `IN PROGRESS` with a
   one-line note saying where it stopped. Never leave a row blank.
4. If a work item turns out to be wrong, do not delete the row — mark it
   `SUPERSEDED` and point at the replacement ID.
5. Commit messages use the format `feat(<tag>): <summary> (UI-DYN-NN)`.

---

## 1. Overview

Five changes ship together as one UI-dynamicity pass. They are independent of
each other and can be implemented in any order, but the order below is
recommended because `UI-DYN-01` creates shared primitives that later items
reuse.

| # | Workstream | Summary |
|---|---|---|
| 1 | Draggable snap-sheets | Bottom-sheet overlays become draggable: grab the handle, drag, and the sheet snaps up or down depending on the drag direction. Applies to the ride-booking sheet, the operator's ride list, the operator's ride detail, the operator's active-ride bar, and the document capture sheet. |
| 2 | Landing-page gating | The **Home** button disappears from the header nav, and the landing page is only reachable by a signed-out visitor. A signed-in user who lands on `/` is sent to their own dashboard. |
| 3 | Loading animation | The spinners are replaced by one shared dot-wave animation with the HATUD wordmark, used on the full-screen loader, the sign-in / sign-up buttons, and the auth waits. |
| 4 | Brand emphasis | The app name in the top-left corner gets a modest bump in weight and size. |
| 5 | Theme ripple | Switching between light and dark mode is no longer instantaneous: a single circular ripple expands out of the theme button and carries the new theme across the page. |

---

## 2. Current State

### 2.1 The surfaces that are already "pop-ups"

| Surface | File | Shape today | Draggable? |
|---|---|---|---|
| Ride booking sheet (commuter) | `src/app/map/page.tsx:296-371` | Bottom sheet, `max-w-md`, `rounded-t-3xl`, drag handle bar at `:298-300` | No — the handle is decorative |
| Operator ride list | `src/app/operator/map/page.tsx:509-577` | Bottom sheet on mobile, left sidebar on `md+` | No — decorative handle at `:512-514` |
| Operator ride detail | `src/app/operator/map/page.tsx:579-701` | Bottom sheet on mobile (`max-h-[70dvh]`), right sidebar on `md+` | No — decorative handle at `:583-585` |
| Operator active-ride bar | `src/app/operator/map/CurrentRidePanel.tsx` | Fixed bottom bar | No |
| Document capture sheet | `src/components/documents/CaptureSheet.tsx:75` | Bottom sheet modal, `items-end` | No |
| Sign-out dialog | `src/components/LogoutDialog.tsx:102` | Centred modal, focus-trapped | n/a — stays a modal (see §4.1.3) |
| Chat bubble | `src/components/ChatBubble.tsx` | Floating pill | n/a — stays a floating bubble (see §4.1.3) |
| Toast | `src/components/Toast.tsx` | Transient notification | n/a — stays transient (see §4.1.3) |

Two of the five sheets already render a **grab handle** that looks draggable but
does nothing. That is the specific lie this workstream removes.

### 2.2 Navigation and the landing page

- `src/components/HeaderClient.tsx:38-43` renders a **Home** link in the nav
  pointing at `/`.
- `src/components/HeaderClient.tsx:31-36` renders the wordmark `Hatud` in the
  top-left, also pointing at `/`, at `font-semibold text-lg`.
- `src/app/page.tsx` is a public marketing page. It renders a "Welcome back /
  Go to Dashboard" card when a session exists (`:52-64`) but **never redirects**
  — a signed-in user can sit on the landing page indefinitely.
- `src/app/login/page.tsx:53-62` already redirects a signed-in user to their
  role dashboard, so the landing page is already bypassed at sign-in.

### 2.3 Loading states

| Location | Current |
|---|---|
| `src/app/loading.tsx:1-8` | `FaSpinner` (rotating icon) |
| `src/components/RouteGuard.tsx:66-70` | `FaSpinner` |
| `src/app/operator/page.tsx:23` | `FaSpinner` |
| `src/app/map/page.tsx:280-286` | Plain text `Loading...` |
| `src/app/admin/page.tsx:100` | Plain text `Loading...` |
| `src/app/login/page.tsx:140` | Button text flips to `Signing in...` |
| `src/app/signup/page.tsx:255` | Button text flips to `Creating...` |

Six different treatments for one concept.

### 2.4 Theme switching

- `src/lib/themeContext.tsx:61-72` — `setTheme` writes `data-theme` on
  `<html>`, persists to `localStorage`, and pushes to Convex.
- `src/app/layout.tsx:39` — the app shell has `transition-colors duration-200`,
  so *some* elements cross-fade, but the map canvas, the header, and every
  element with its own background swaps instantly.
- `src/components/ThemeToggle.tsx` — a 44×44 icon button in the header and the
  mobile bottom bars.
- `src/components/ThemeSlider.tsx` — a 96×48 switch on the profile page.
- `src/app/map/useMapInstance.ts` — the creation effect is guarded by
  `if (mapRef.current) return`, so the theme effect re-runs, hits the guard
  and does nothing. **The map never changed style at all.** See §4.5.2.

---

## 3. Goals & Non-Goals

### Goals

1. Every bottom sheet in the app is draggable, with a visible grab handle that
   actually responds to a pointer.
2. Releasing a drag settles the sheet into the nearest detent, and a decisive
   flick moves it one detent **in the direction of the drag**.
3. Dragging a sheet far enough down dismisses it; dragging back up re-opens it.
4. The landing page is a signed-out-only page.
5. One loading animation, used everywhere the app waits.
6. The wordmark reads as the app name without shouting.
7. The theme change is a circular ripple anchored on the theme control, not a
   hard cut.

### Non-goals

- No change to any Convex function, schema, or query.
- No change to what login, signup, booking, or logout *do*.
- No change to the colour tokens in `src/app/globals.css`.
- No new UI library. Everything here is hand-rolled on top of React 19 and
  Tailwind 4, matching the rest of the codebase.
- The map's own tile/style rendering is not re-engineered (see §8.1).

---

## 4. Workstreams

### 4.1 WS-A — Draggable snap-sheets

#### 4.1.1 `UI-DYN-01` — The `DragSheet` primitive

**New file:** `src/components/DragSheet.tsx`
**New file:** `src/lib/useMediaQuery.ts`
**New file:** `src/lib/useReducedMotion.ts`

Create one reusable sheet that owns the drag physics. Every sheet in the app
becomes a consumer of it; no sheet gets its own bespoke pointer handling.

**Public API**

```tsx
export interface SnapPoint {
  /** Stable id, surfaced to onSnapChange and to keyboard users. */
  id: string;
  /** Visible height of the sheet, as a fraction of its own content height. */
  ratio: number;
}

interface DragSheetProps {
  children: ReactNode;
  /** Detents. A ratio may be above 1, which lets the sheet grow past its
      content so the layout has room to breathe. */
  snaps: SnapPoint[];
  /** Detent selected on mount. */
  defaultSnapId?: string;
  /** Height of the app chrome above the sheet (px). */
  topInset?: number;
  /** Height of the app chrome below the sheet (px). */
  bottomInset?: number;
  /** Called when the user drags past the dismiss threshold. */
  onDismiss?: () => void;
  /** Called when the sheet settles onto a new detent. */
  onSnapChange?: (snapId: string) => void;
  /** Extra classes on the outer sheet element. */
  className?: string;
  /** Classes for the scrolling body, below the grab handle. */
  bodyClassName?: string;
  /** Pinned below the scrolling body, never scrolled out of view. */
  footer?: ReactNode;
  /** Forces dragging off (used for the desktop sidebar layouts). */
  disabled?: boolean;
  /** Accessible label for the grab handle. */
  handleLabel?: string;
  /** Label of the pill that brings a dismissed sheet back. */
  dismissLabel?: string;
  /** `sheet` is a draggable bottom sheet, `panel` a static sidebar. */
  variant?: "panel" | "sheet";
}
```

**Layout model**

- The outer element gets an explicit pixel `height` and `overflow: hidden`.
- The inner content wrapper is `height: 100%; overflow-y: auto;
  overscroll-contain` so the body scrolls *inside* the visible window.
- The natural content height is measured with a `ResizeObserver` on the
  innermost content wrapper, so a sheet whose content grows (a longer landmark
  list, a new ride) re-measures and its detents follow. The measurement runs
  through a callback ref, not an effect, because the sheet unmounts while it
  is dismissed.
- The handle and the footer are **chrome**: they are always on screen, so a
  sheet can never be smaller than the two of them together.
- Available height = `window.innerHeight - topInset - bottomInset`.
- **A detent is a fraction of the sheet's own content height, not of the
  viewport.** A sheet whose content is short must still have somewhere to be
  dragged to, and a sheet must never show more empty surface than it has to.
  A detent therefore resolves to
  `chrome + min(contentHeight * ratio, availableHeight - chrome)`.
- Detents are de-duplicated and sorted ascending. If two detents resolve to
  the same height they are the same detent, and a sheet left with fewer than
  two has nothing to drag — dragging is switched off for it.

**Where the sheet sits**

The map screens float an 85 px navigation bar over the bottom of the
viewport. A sheet that reached the bottom would have its grab handle under
that bar, which makes the handle a lie again. So every sheet sits *above* the
navigation bar (`bottom-[var(--bottom-nav-height)]`), and the height is
exposed to CSS as a custom property on `<body>` so the bar and the sheets
agree on one number (`src/lib/layout.ts`).

**Drag physics**

| Constant | Value | Meaning |
|---|---|---|
| `FLICK_VELOCITY` | `0.4` px/ms | Above this the sheet moves one detent in the drag direction |
| `SNAP_DISTANCE` | `48` px | Past this the sheet moves in the direction of the drag |
| `DISMISS_TOLERANCE` | `24` px | Dragged this far below the smallest detent dismisses the sheet |
| `HANDLE_HEIGHT` | `44` px | The grab handle is chrome and is always on screen |
| `SETTLE_DURATION` | `280` ms | Height transition on release |
| `SETTLE_EASING` | `cubic-bezier(0.32, 0.72, 0, 1)` | iOS-style settle |

On `pointerdown` on the handle:

- `setPointerCapture` so the drag survives the pointer leaving the handle.
- Record `startY`, `startHeight`, `startTime`, and the currently settled detent.
- Switch the height transition **off** (a `data-dragging="true"` attribute on
  the sheet drives `transition: none`).

On `pointermove`:

- `delta = startY - event.clientY` (positive = dragging **up**).
- `next = clamp(startHeight + delta, minDetentHeight, availableHeight)`.
- Write `next` straight to the element's height. No React state per frame —
  the height is held in a ref and mirrored into state only on release, so a
  drag does not re-render the subtree 60 times a second.

On `pointerup` / `pointercancel`:

```
if (velocity > FLICK_VELOCITY)        target = nextDetentAbove(current)
else if (velocity < -FLICK_VELOCITY)  target = nextDetentBelow(current)
else if (delta > SNAP_DISTANCE)       target = nextDetentAbove(current)
else if (delta < -SNAP_DISTANCE)      target = nextDetentBelow(current)
else                                  target = nearestDetent(nextHeight)

if (onDismiss && rawHeight < smallestDetent - DISMISS_TOLERANCE) {
  onDismiss();
  return;
}
```

A drag that travels far enough crosses more than one detent, so the target
is the detent the sheet has been dragged *into*, not simply the next one
along. A flick, by contrast, always moves exactly one detent.

- Turn the height transition back on and animate to `target`.
- Fire `onSnapChange(target.id)`.
- Re-arm dismissal: if the user drags back up, the sheet re-opens normally.

**Accessibility (non-negotiable)**

- The handle is a `role="separator"` with `aria-valuenow`, `aria-valuemin`,
  `aria-valuemax` and `aria-label` — the ARIA pattern for a **window
  splitter**. There is no native element for it: `<hr>` is a thematic break,
  not a resizable one. (Biome's `useSemanticElements` rule is suppressed on
  that element with a comment explaining why.)
- `ArrowUp` / `ArrowDown` move one detent. `Home` collapses to `peek`.
  `End` expands to `full`. `Escape` dismisses.
- The handle gets `touch-action: none` so a touch drag never scrolls the page
  or the map behind it.
- `prefers-reduced-motion: reduce` → the height transition duration drops to
  `0ms` and the flick threshold stays, so behaviour is unchanged, only the
  animation is removed.

**Why pointer events and not touch events**

The app ships inside a Capacitor Android WebView and on desktop browsers.
Pointer events cover mouse, touch and pen with one code path, and
`setPointerCapture` removes the need for document-level listeners.

#### 4.1.2 `UI-DYN-02` — Ride booking sheet (commuter)

**File:** `src/app/map/page.tsx:296-371`

- Replace the hand-rolled bottom-sheet `<div>` with `<DragSheet>`.
- Detents, as a fraction of the sheet's own content: `peek` `0.35`,
  `half` `0.7`, `full` `1`, `expanded` `1.6`. Default `full`, which is
  exactly the content height — the sheet opens looking the way it always
  did.
- `bottomInset` = the height of the mobile nav bar, so the sheet can never
  grow past it and the grab handle is never covered.
- The existing grab handle at `:298-300` becomes the `DragSheet` handle, and
  its colour changes on `data-dragging="true"` so the sheet visibly responds
  to the finger.
- `onDismiss` sets `step` back to `"location"` and clears the selected vehicle.
  Dragging the sheet away mid-booking must not leave a stale selection.
- The internal scroll container keeps `pb-24` so the sheet never traps the
  mobile nav bar.
- The `pointer-events-none` wrapper at `:296` must keep its
  `pointer-events-auto` child, or the map underneath will eat the drag.

**Acceptance criteria**

- Dragging the handle up expands the sheet to `full`; releasing it settles.
- A short upward flick moves one detent up; a short downward flick moves one
  detent down.
- Dragging the sheet down past the dismiss threshold hides it and the map is
  fully visible.
- Dragging back up re-opens it.
- Typing in the pickup field still scrolls the sheet content normally — the
  drag only listens on the handle.

#### 4.1.3 `UI-DYN-03` — Operator ride list sheet

**File:** `src/app/operator/map/page.tsx:509-577`

- Wraps the existing panel in `<DragSheet>` for the mobile layout.
- Detents: `peek` `0.35`, `half` `0.7`, `full` `1`, `expanded` `1.6`.
- On `md+` the panel is a **left sidebar**, not a sheet. Use
  `useMediaQuery("(min-width: 768px)")` and the `panel` variant — no drag,
  no handle, layout unchanged.
- `onDismiss` clears the selected ride and the ride list becomes hidden.
  The operator must still be able to get the panel back: render a small
  "Rides" handle button pinned to the bottom-left when the sheet is
  dismissed.

#### 4.1.4 `UI-DYN-04` — Operator ride detail sheet

**File:** `src/app/operator/map/page.tsx:579-701`

- Same treatment as the ride list. Detents: `peek` `0.35`, `half` `0.7`,
  `full` `1`, `expanded` `1.6`.
- `onDismiss` clears `selectedRide` (the ride list returns).
- The `max-h-[70dvh]` cap at `:579` is replaced by the `DragSheet` detent
  model, so the sheet can actually reach full height.

#### 4.1.5 `UI-DYN-05` — Operator active-ride bar

**File:** `src/app/operator/CurrentRidePanel.tsx`

- This is a bar, not a sheet, but it is the same kind of surface. Convert it
  to `DragSheet` with three detents: `peek` `0.5` (the compact bar),
  `full` `1` and `expanded` `1.5`.
- The action buttons move into the sheet's **footer slot**, which is pinned
  below the scrolling body. They therefore stay reachable when the sheet is
  collapsed to its smallest size, which they were not before.
- On `md+` the panel stays a static box, exactly as it was.
- `onDismiss` is **not** offered here: the active ride must stay visible.
  The operator can still collapse it to `peek`.

#### 4.1.6 `UI-DYN-06` — Document capture sheet

**File:** `src/components/documents/CaptureSheet.tsx:75`

- Detents: `half` `0.75`, `full` `1`, `expanded` `1.4`. No `peek` — a capture
  sheet with only its handle visible is useless.
- `onDismiss` calls the existing close handler. The sheet must not close while
  a camera capture is in flight; guard on the existing busy state.
- The `role="dialog"` / `aria-modal` pair stays on a wrapper around the sheet,
  so the modal semantics are not lost.

#### 4.1.7 `UI-DYN-07` — Shared motion tokens

**File:** `src/app/globals.css`

Add the motion tokens once so the sheet, the loader and the theme ripple share
one vocabulary:

```css
:root {
  --motion-settle-duration: 280ms;
  --motion-settle-easing: cubic-bezier(0.32, 0.72, 0, 1);
  --motion-ripple-duration: 460ms;
  --motion-ripple-easing: cubic-bezier(0.4, 0, 0.2, 1);
  --motion-loader-cycle: 1.1s;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-settle-duration: 0ms;
    --motion-ripple-duration: 0ms;
    --motion-loader-cycle: 2.4s;
  }
}
```

---

### 4.2 WS-B — Landing page & navigation

#### 4.2.1 `UI-DYN-08` — Remove the Home button and gate the landing page

**Files:** `src/components/HeaderClient.tsx`, `src/app/page.tsx`

`HeaderClient.tsx`:

- **Delete** the `Home` nav link at `:38-43`.
- The wordmark link at `:31-36` stops pointing at `/`. It points at the
  signed-in user's dashboard: `/admin`, `/operator/map`, or `/map`. Use
  `useAuth()` for the role; when there is no session it falls back to `/`.
- `src/lib/roles.ts` holds the one role → route map. `RouteGuard`,
  `HeaderClient`, `src/app/page.tsx` and `src/app/login/page.tsx` all import
  it instead of carrying their own copy.
- Add a `ROLE_HOME` map — `RouteGuard.tsx:30-34` already has one; reuse the
  same shape and values so there is a single source of truth. **Extract it to
  `src/lib/roles.ts`** and import it in `RouteGuard`, `HeaderClient`,
  `src/app/page.tsx` and `src/app/login/page.tsx` (all four currently have
  their own copy of the role→route mapping: `RouteGuard.tsx:30-34`,
  `page.tsx:6-15`, `login/page.tsx:27-36`).

`src/app/page.tsx`:

- On mount, if a session exists, `router.replace(ROLE_HOME[user.role])`.
- While the session is still being validated, render the shared loader
  (`UI-DYN-10`) rather than flashing the marketing page.
- **Delete** the "Welcome back / Go to Dashboard" card at `:52-64` — with the
  redirect in place it is unreachable.
- The landing page keeps its Sign In / Sign Up buttons for signed-out
  visitors.

**Why the landing page is not deleted**

The landing page is still the first thing a signed-out visitor sees, and it is
the only public marketing surface. It is *gated*, not removed.

**Acceptance criteria**

- There is no "Home" item in the header nav on any page.
- Clicking the wordmark takes a signed-in user to their own dashboard.
- Navigating to `/` while signed in lands on the role dashboard, and the
  landing page never flashes.
- The landing page still renders for a signed-out visitor.

#### 4.2.2 `UI-DYN-09` — Sign-out destination check

**File:** `src/lib/authContext.tsx:156-168`

`logout()` currently calls `router.replace("/login")`. That is correct and
stays — signing out must land on the sign-in form, not the landing page.
Confirm no other code paths route a signed-in user to `/`.

---

### 4.3 WS-C — Loading animation

#### 4.3.1 `UI-DYN-10` — The `AppLoader` component

**New file:** `src/components/AppLoader.tsx`

One component, two variants:

| Variant | Use | Renders |
|---|---|---|
| `full` | Full-screen waits | Wordmark + three dots + optional label |
| `inline` | Inside a button | Three dots only |

Visual: the wordmark `HATUD` in `font-bold tracking-[0.3em]` above three dots
that rise and fall in sequence. Each dot scales from `0.6` → `1` and fades
from `0.35` → `1`, staggered by `0.15s`.

Keyframes in `src/app/globals.css`:

```css
@keyframes loader-dot {
  0%, 60%, 100% { opacity: 0.35; transform: translateY(0) scale(0.6); }
  30%           { opacity: 1;    transform: translateY(-4px) scale(1); }
}

.loader-dot {
  animation: loader-dot var(--motion-loader-cycle) ease-in-out infinite;
}
.loader-dot:nth-child(2) { animation-delay: 0.15s; }
.loader-dot:nth-child(3) { animation-delay: 0.3s; }
```

With `prefers-reduced-motion: reduce` the dots stop rising and just pulse
opacity, so the loader still communicates "working".

#### 4.3.2 `UI-DYN-11` — Replace every loader

| File | Line | Change |
|---|---|---|
| `src/app/loading.tsx` | `:1-8` | `FaSpinner` → `<AppLoader variant="full" />` |
| `src/components/RouteGuard.tsx` | `:5`, `:66-70` | `FaSpinner` → `<AppLoader variant="full" />` |
| `src/app/operator/page.tsx` | `:5`, `:23` | `FaSpinner` → `<AppLoader variant="full" />` |
| `src/app/map/page.tsx` | `:280-286` | `Loading...` text → `<AppLoader variant="full" />` |
| `src/app/admin/page.tsx` | `:100` | `Loading...` text → `<AppLoader variant="full" />` |
| `src/app/login/page.tsx` | `:140` | `Signing in...` → `<AppLoader variant="inline" />` inside the button |
| `src/app/signup/page.tsx` | `:255` | `Creating...` → `<AppLoader variant="inline" />` |

Two notes:

- The **inline** variant must keep the button's height stable — the button
  already has a fixed `py-3`, and the dot row is `h-1` dots, so the label
  simply disappears and the dots take its place. Keep `aria-live="polite"` on
  the button and a visually hidden "Signing in" string so screen readers are
  not left with an unlabelled button.
- The **full** variant must not introduce a scrollbar or a layout shift.
- Inline spinners that represent *content*, not page readiness
  (`RideProgressPanel.tsx:40`, `:62`, `LocationStep.tsx:73`,
  `ChatBubble.tsx:143`, `:206`, `payment/page.tsx:185`) **stay as they are** —
  they are progress indicators inside a panel, not loaders. The brief asks
  for a loading screen, not for every spinner in the app to change.

#### 4.3.3 `UI-DYN-12` — Auth wait state

**File:** `src/app/map/page.tsx:280-286`

The map page waits for `authLoading || !user`. This is the "opening" wait the
brief refers to: after login the user sees the map screen while the session
resolves. Replace the plain `Loading...` text with `<AppLoader variant="full" />`
so it matches `src/app/loading.tsx` exactly — the transition from the login
screen to the app should not change visual language.

The landing page waits for the same thing. A signed-out visitor gets the
marketing page; a signed-in visitor gets the loader for the moment it takes
to send them to their dashboard, so the landing page never flashes.

---

### 4.4 WS-D — Brand emphasis

#### 4.4.1 `UI-DYN-13` — The top-left wordmark

**File:** `src/components/HeaderClient.tsx:31-36`

Current: `font-semibold text-lg`. New: `font-bold text-2xl tracking-tight`.

That is the whole change — a bump in weight and a step in size, nothing more.
No colour change, no logo lockup, no letter-spacing stunt.

The same wordmark is rendered in two other places and they are bumped for
consistency, at a smaller increment:

| File | Line | Current | New |
|---|---|---|---|
| `src/app/login/page.tsx` | `:84-86` | `font-bold text-3xl` | `font-bold text-4xl tracking-tight` |
| `src/components/AppLoader.tsx` | new | — | `font-bold tracking-[0.3em]` |

---

### 4.5 WS-E — Theme ripple

#### 4.5.1 `UI-DYN-14` — The ripple transition

**New file:** `src/lib/themeTransition.ts`
**Files:** `src/lib/themeContext.tsx`, `src/components/ThemeToggle.tsx`,
`src/components/ThemeSlider.tsx`, `src/app/globals.css`

**Mechanism:** the View Transitions API. `document.startViewTransition()` is
already typed in TypeScript 5.9.3 (`node_modules/typescript/lib/lib.dom.d.ts`),
so no ambient declaration file is needed.

**Context changes** — `themeContext.tsx`

Extend the context so the switch can carry an origin:

```tsx
interface ThemeTransitionOrigin {
  x: number;
  y: number;
}

interface ThemeContextType {
  setTheme: (theme: Theme, origin?: ThemeTransitionOrigin) => void;
  theme: Theme;
  toggleTheme: (origin?: ThemeTransitionOrigin) => void;
}
```

`setTheme` becomes:

1. If there is no origin, or the browser has no `startViewTransition`, apply
   the theme directly and return. **This is the fallback**: the page changes
   with the existing `transition-colors duration-200` on the app shell.
2. Otherwise compute the ripple radius:

   ```ts
   const radius = Math.hypot(
     Math.max(origin.x, window.innerWidth - origin.x),
     Math.max(origin.y, window.innerHeight - origin.y)
   );
   ```

   The radius must reach the farthest corner, otherwise the ripple leaves an
   uncovered sliver.
3. Start the transition, and inside its update callback apply the theme
   (`data-theme` attribute + `localStorage` + the Convex mutation) so the new
   snapshot is captured in the new theme.
4. On `transition.ready`, animate the new snapshot's clip path:

   ```ts
   document.documentElement.animate(
     {
       clipPath: [
         `circle(0px at ${origin.x}px ${origin.y}px)`,
         `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
       ],
     },
     {
       duration: 460,
       easing: "cubic-bezier(0.4, 0, 0.2, 1)",
       pseudoElement: "::view-transition-new(root)",
     }
   );
   ```

**CSS** — `src/app/globals.css`

The default cross-fade must be suppressed, or it fights the ripple:

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}

::view-transition-old(root) { z-index: 1; }
::view-transition-new(root) { z-index: 2; }
```

Also suppress CSS transitions on the page *during* the transition, so the
app-shell `transition-colors duration-200` does not double-animate:

```css
html[data-theme-transition="active"] *,
html[data-theme-transition="active"] *::before,
html[data-theme-transition="active"] *::after {
  transition: none !important;
}
```

The `data-theme-transition="active"` attribute is set on `<html>` before
`startViewTransition` and removed in `transition.finished.finally`.

**Trigger** — `ThemeToggle.tsx`

- Measure the button's own rect on click and pass its centre as the origin:
  `const rect = event.currentTarget.getBoundingClientRect()`.
- The ripple therefore starts exactly at the moon/sun icon.

**Trigger** — `ThemeSlider.tsx`

- The slider's origin is the **knob** (the moving circle), not the switch
  track, so the ripple starts where the user's eye is.
- The knob already slides with `transition-transform duration-200`; leave it.

**Reduced motion**

`prefers-reduced-motion: reduce` → skip the View Transition entirely and apply
the theme directly. The change is still not instantaneous (the app shell's
colour transition covers it), but no ripple is drawn.

**Acceptance criteria**

- Clicking the theme button does not hard-cut: a circular wave of the new
  theme expands from the button and carries across the whole page.
- The switch is animated in both directions (light → dark and dark → light).
- The preference still persists to `localStorage` and to Convex.
- On a browser without View Transitions the theme still switches, with the
  existing colour fade.

#### 4.5.2 `UI-DYN-15` — Map style swap during the ripple

**File:** `src/app/map/useMapInstance.ts:35-53`

The map instance is destroyed and rebuilt whenever `theme` changes, and the
rebuild is asynchronous (a style JSON fetch). The View Transition snapshots
the page synchronously, so the **new** snapshot can capture the map still
painted in the old style. The user sees the map flip to the new style *after*
the ripple finishes, which reads as a glitch.

**Preferred fix:** give the map its own transition layer.

- Put `view-transition-name: map` on the map container in `src/app/map/page.tsx`
  and `src/app/operator/map/page.tsx`.
- An element with its own `view-transition-name` is lifted out of the root
  snapshot, so the root ripple only carries the page chrome and the map
  cross-fades in its own layer with the default animation.

**Fallback if that proves unreliable in the Android WebView:** keep the map out
of the transition entirely and swap its style *after* `transition.finished`,
accepting that the map area stays in the old theme for the duration of the
ripple.

**This item is deliberately last and is verified by hand on both desktop and
the Android WebView** (see §8.1).

---

## 5. File Register

### New files

| File | Purpose | Item |
|---|---|---|
| `src/components/DragSheet.tsx` | Draggable snap-sheet primitive | `UI-DYN-01` |
| `src/components/AppLoader.tsx` | Shared loading animation | `UI-DYN-10` |
| `src/lib/themeTransition.ts` | View Transitions ripple helper | `UI-DYN-14` |
| `src/lib/roles.ts` | Single source of truth for role → route | `UI-DYN-08` |
| `src/lib/useMediaQuery.ts` | Media-query hook for the desktop layouts | `UI-DYN-01` |
| `src/lib/useReducedMotion.ts` | Reduced-motion hook | `UI-DYN-01` |

### Modified files

| File | Change | Item |
|---|---|---|
| `src/app/globals.css` | Motion tokens, loader keyframes, view-transition CSS | `UI-DYN-07`, `UI-DYN-10`, `UI-DYN-14` |
| `src/app/map/page.tsx` | `DragSheet` for the booking sheet, loader, map transition name | `UI-DYN-02`, `UI-DYN-12`, `UI-DYN-15` |
| `src/app/operator/map/page.tsx` | `DragSheet` for ride list and ride detail | `UI-DYN-03`, `UI-DYN-04`, `UI-DYN-15` |
| `src/app/operator/map/CurrentRidePanel.tsx` | `DragSheet` for the active-ride bar | `UI-DYN-05` |
| `src/components/documents/CaptureSheet.tsx` | `DragSheet` for the capture sheet | `UI-DYN-06` |
| `src/components/HeaderClient.tsx` | Remove Home, role-aware wordmark, larger wordmark | `UI-DYN-08`, `UI-DYN-13` |
| `src/app/page.tsx` | Redirect signed-in users, remove the welcome card | `UI-DYN-08` |
| `src/app/login/page.tsx` | Inline loader, larger wordmark, shared role map | `UI-DYN-11`, `UI-DYN-13` |
| `src/app/signup/page.tsx` | Inline loader | `UI-DYN-11` |
| `src/app/loading.tsx` | Shared loader | `UI-DYN-11` |
| `src/app/admin/page.tsx` | Shared loader | `UI-DYN-11` |
| `src/app/operator/page.tsx` | Shared loader | `UI-DYN-11` |
| `src/components/RouteGuard.tsx` | Shared loader, shared role map | `UI-DYN-08`, `UI-DYN-11` |
| `src/lib/themeContext.tsx` | Theme change accepts a ripple origin | `UI-DYN-14` |
| `src/components/ThemeToggle.tsx` | Pass the button's centre as the origin | `UI-DYN-14` |
| `src/components/ThemeSlider.tsx` | Pass the knob's centre as the origin | `UI-DYN-14` |

### Observation, not a change

`src/app/operator/CurrentRidePanel.tsx` is a **duplicate** of
`src/app/operator/map/CurrentRidePanel.tsx` and nothing imports it. It was
left exactly as it was. It should be deleted, but deleting files is outside
the scope of this plan.

### Explicitly not modified

| File | Reason |
|---|---|
| `convex/**` | No backend change is in scope |
| `src/components/LogoutDialog.tsx` | A centred, focus-trapped modal — not a sheet. Dragging a confirm dialog off-screen is a destructive gesture, and the dialog already handles Escape, focus trap and focus restore. |
| `src/components/Toast.tsx` | Transient notification — it has a lifetime, not a position. |
| `src/components/ChatBubble.tsx` | A floating bubble, not a sheet. It already has a `positionOverride` prop for placement. |
| `src/app/map/RideProgressPanel.tsx` | Content *inside* the booking sheet — it inherits the sheet's drag behaviour. |

---

## 6. Design Language

| Token / rule | Value |
|---|---|
| Sheet corner radius | `rounded-t-3xl` (unchanged) |
| Sheet surface | `bg-[var(--background)]/95 backdrop-blur-xl` (unchanged) |
| Sheet border | `border-2 border-[var(--border)]` (unchanged) |
| Grab handle | `h-2 w-16 rounded-full`, `bg-[var(--surface-muted)]`; on drag → `bg-[var(--accent)]` |
| Handle hit area | minimum 44×44 px, even though the visual bar is 8 px tall |
| Sheet settle | 280 ms, `cubic-bezier(0.32, 0.72, 0, 1)` |
| Theme ripple | 460 ms, `cubic-bezier(0.4, 0, 0.2, 1)` |
| Loader cycle | 1.1 s, 0.15 s stagger |
| Wordmark | `font-bold text-2xl tracking-tight` (header), `font-bold text-4xl tracking-tight` (login) |

Everything is expressed with the existing CSS custom properties so it follows
the light/dark theme automatically. No hard-coded colours are introduced.

---

## 7. Verification

Run after **every** work item, not just at the end:

```bash
npm run typecheck   # tsc --noEmit
npm run check       # ultracite check  (Biome)
npm run test        # vitest run
```

Manual checks, once per workstream:

| Item | Manual check | How |
|---|---|---|
| `UI-DYN-01` … `06` | Drag up, drag down, flick both ways, drag past dismiss, re-open | On a real phone or a browser device-emulation touch profile; a mouse drag is not the same gesture |
| `UI-DYN-01` … `06` | Content still scrolls | Scroll the sheet body with the mouse wheel and with a finger |
| `UI-DYN-02` … `06` | Keyboard | Focus the handle, use ArrowUp / ArrowDown / Home / End / Escape |
| `UI-DYN-08` | Landing gate | Sign in, navigate to `/` by hand, confirm the redirect |
| `UI-DYN-08` | No Home button | Check the header on `/profile`, `/admin`, `/payment`, `/feedback` |
| `UI-DYN-10` … `12` | Loader | Throttle the network to Slow 3G and watch every wait state |
| `UI-DYN-13` | Wordmark | Check the header, the login page and the loader |
| `UI-DYN-14` | Ripple | Toggle in both directions; check the ripple starts at the button |
| `UI-DYN-14` | Fallback | Turn off View Transitions in DevTools (`document.startViewTransition = undefined`) and toggle again |
| `UI-DYN-14` | Reduced motion | Emulate `prefers-reduced-motion: reduce` and toggle again |
| `UI-DYN-15` | Map during ripple | Toggle on `/map` and watch the map tiles during the transition |

---

## 8. Known Issues & Risks

### 8.1 The map canvas and the View Transition

**Risk (high).** MapLibre renders into a `<canvas>`. A View Transition captures
the page as a static image, so a canvas that is mid-redraw is captured frozen.

**Mitigation:** `.maplibregl-map` carries `view-transition-name: map`, which
lifts the canvas out of the page-level snapshot. The ripple never clips the
map: the page chrome ripples, and the map cross-fades in its own layer above
it.

**Still open.** The map's *new* snapshot is captured before the new style has
finished loading, so the map visibly changes style at the end of the ripple
rather than during it. The canvas fade softens the change, but it does not
remove it.

**Verification:** must be checked on the Android WebView, not only in a desktop
browser. The WebView's View Transitions support varies by Android System WebView
version.

### 8.2 Drag and map gestures colliding

**Risk (medium).** The map is under the sheet; a drag that starts on the sheet
handle must not pan the map, and a drag that starts on the map must not move
the sheet.

**Mitigation:** the sheet's outer wrapper keeps `pointer-events-none` and only
the sheet itself is `pointer-events-auto` (`src/app/map/page.tsx:296-297`).
`touch-action: none` on the handle stops the browser from scrolling the page
behind it.

### 8.3 Content taller than the viewport

**Risk (medium).** The landmark list, the ride queue and the ride detail panel
all grow with data. A detent defined as a fixed pixel height would clip them.

**Mitigation:** detents are ratios of the available height, clamped to the
measured content height, and the content is re-measured with a `ResizeObserver`
so the sheet follows its content.

### 8.4 Dragging changes layout in the operator map

**Risk (low).** The operator map's sheets are `absolute`-positioned inside the
map container. Converting them to `DragSheet` must not change their desktop
sidebar layout.

**Mitigation:** `disabled` is driven by a `(min-width: 768px)` media query, so
the desktop layout keeps the existing markup path untouched.

### 8.5 The grab handle and the bottom navigation bar

**Risk (high).** The map screens float an 85 px navigation bar over the
bottom of the viewport. A sheet that reached the bottom of the screen put its
grab handle underneath that bar, where it could not be touched — the exact
"decorative handle" the workstream set out to remove. Caught by the automated
interaction test, not by reading the code.

**Mitigation:** every sheet sits above the navigation bar, and the height is
declared once in `src/lib/layout.ts` and exposed to CSS as
`--bottom-nav-height`.

### 8.6 `data-theme` is set in three places

**Risk (low).** `themeContext.tsx` writes `data-theme` from three code paths
(storage read at `:44`, server preference at `:57`, and `setTheme` at `:64`).
Only the last one should animate; the first two are initial state.

**Mitigation:** the ripple lives inside `setTheme` only. The two initial-state
paths are unchanged and never animate.

---

## 9. Progress Log

| ID | Task | Tag | Status | Notes | Date |
|---|---|---|---|---|---|
| `UI-DYN-01` | `DragSheet` primitive + hooks | DRAG | ☑ Done | `src/components/DragSheet.tsx`, `useMediaQuery`, `useReducedMotion`. Pointer capture, content-relative detents, footer slot, window-splitter handle | 2026-10-27 |
| `UI-DYN-02` | Ride booking sheet | DRAG | ☑ Done | `src/app/map/page.tsx`. Sits above the nav bar; 4 detents; dismiss leaves a "Book a ride" pill | 2026-10-27 |
| `UI-DYN-03` | Operator ride list sheet | DRAG | ☑ Done | `src/app/operator/map/page.tsx`. `panel` variant on `md+`, sheet on mobile | 2026-10-27 |
| `UI-DYN-04` | Operator ride detail sheet | DRAG | ☑ Done | `src/app/operator/map/page.tsx`. Dismiss clears the selected ride | 2026-10-27 |
| `UI-DYN-05` | Operator active-ride bar | DRAG | ☑ Done | `src/app/operator/map/CurrentRidePanel.tsx`. Actions moved into the footer slot | 2026-10-27 |
| `UI-DYN-06` | Document capture sheet | DRAG | ☑ Done | `src/components/documents/CaptureSheet.tsx`. Dialog semantics kept on a wrapper | 2026-10-27 |
| `UI-DYN-07` | Motion tokens in globals.css | DRAG | ☑ Done | Tokens, loader keyframes, view-transition CSS, reduced-motion overrides | 2026-10-27 |
| `UI-DYN-08` | Remove Home button + gate landing | LAND | ☑ Done | `src/lib/roles.ts` extracted and shared by four files | 2026-10-27 |
| `UI-DYN-09` | Sign-out destination check | LAND | ☑ Done | `logout()` still lands on `/login`; no path routes a signed-in user to `/` | 2026-10-27 |
| `UI-DYN-10` | `AppLoader` component | LOAD | ☑ Done | `src/components/AppLoader.tsx`, `full` and `inline` variants | 2026-10-27 |
| `UI-DYN-11` | Replace all loaders | LOAD | ☑ Done | 7 loaders replaced. Progress spinners inside panels left alone on purpose | 2026-10-27 |
| `UI-DYN-12` | Auth wait state | LOAD | ☑ Done | Map page and landing page now share the same loader | 2026-10-27 |
| `UI-DYN-13` | Wordmark emphasis | BRAND | ☑ Done | Header `font-bold text-2xl tracking-tight`; login `text-4xl` | 2026-10-27 |
| `UI-DYN-14` | Theme ripple (View Transitions) | THEME | ☑ Done | `src/lib/themeTransition.ts`. Origin from the toggle button / slider knob, fade fallback, reduced motion honoured | 2026-10-27 |
| `UI-DYN-15` | Map style swap during the ripple | THEME | ☑ Done | The map was never following the theme at all — fixed with `setStyle` + canvas fade. See §8.1 for what is still open | 2026-10-27 |

**Status legend:** ☐ Not started · ◐ In progress · ☑ Done · ⊘ Superseded

### Change Log

| Date | Change |
|---|---|
| 2026-10-27 | Plan created. Scope confirmed with the requester: all 5 bottom sheets dismissible; View Transitions with a fade fallback; signed-in users redirected away from `/`; dot-wave loader with the brand mark; modest wordmark bump. |
| 2026-10-27 | All 15 items implemented. The detent model was changed from viewport-relative to **content-relative** during `UI-DYN-01`: a sheet whose content is shorter than the viewport fractions ended up with every detent collapsing to the same height, which left the grab handle doing nothing. The `expanded` detent (a ratio above 1) was added so a sheet can also grow past its content. |
| 2026-10-27 | The sheets were moved above the 85 px bottom navigation bar. The handle had ended up underneath it and could not be touched — see §8.5. |
| 2026-10-27 | `UI-DYN-05` gained a footer slot so the operator's action buttons stay reachable when the sheet is collapsed. |
| 2026-10-27 | `UI-DYN-15` found a pre-existing bug: the map never changed style with the theme. Fixed while doing the ripple. |

### Verification performed

| Check | Result |
|---|---|
| `npm run typecheck` | ☑ Pass |
| `npm run check` (Ultracite / Biome) | ☑ Pass |
| `npm run test` | ☑ 87 tests pass |
| `npm run build` | ☑ Static export builds |
| Browser interaction test (Playwright, 420×820 touch) | ☑ 17/18 checks pass; the one failure is a `GeolocationPositionError` from headless Chromium having no GPS, not a defect |

**Checks covered by the browser test:** the landing page renders for a signed-out
visitor · sign-in lands on the role dashboard · the header has no Home link ·
a signed-in visitor is redirected away from `/` · the booking sheet has a grab
handle · dragging the handle up grows the sheet · dragging it down shrinks
it · dragging it away dismisses it · the dismissed sheet leaves a way back ·
the way back restores the sheet · the wordmark is 24 px / weight 700 · the
theme change runs a view transition · the theme actually changed · the loader
renders the dot wave · the arrow keys resize the sheet · the operator ride
queue grows when dragged up.

### Still to verify by hand

| Item | Check |
|---|---|
| `UI-DYN-01` … `06` | Every sheet on a real phone, in the Android WebView |
| `UI-DYN-14` | The ripple in the Android WebView, where View Transitions support depends on the System WebView version |
| `UI-DYN-15` | The map style change during the ripple on both desktop and Android (see §8.1) |
| `UI-DYN-02` | The booking sheet against a real fare quote, where the content is much taller than on an empty booking |
| `UI-DYN-06` | The capture sheet while a camera capture is in flight |
