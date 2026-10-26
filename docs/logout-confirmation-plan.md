# Logout Relocation & Confirmation — Implementation Plan

## Overview

Signing out is destructive and unrecoverable without re-entering a password,
yet the app put a one-tap **Logout** button inside the passenger's live map —
in the same strip as the pickup/dropoff fields, one thumb-slide away from
booking a ride. A single mis-tap ends the session mid-journey.

This document defines two changes:

1. **The logout button moves out of the map screens and into Settings.**
2. **Every logout in the app is confirmed by a dialog that names the account
   being signed out.**

## Problem Statement

### The misplaced button

`src/app/map/MapOverlays.tsx` renders a fixed bottom bar on phones. It holds
the rider's name chip, the theme toggle, and a **Logout** button. The ride
booking sheet — pickup field, destination field, "Choose a ride" — sits
directly above it in the same column, and the sheet's own padding
(`pb-24`) exists only to clear the bar. The result: a destructive action
rendered shoulder-to-shoulder with the location selector.

On desktop the same button sits in the name card in the top-left of the map,
next to the rider's name and the Profile link.

`src/app/operator/OperatorHeader.tsx` has the mirror image of the same
problem: a **Logout** button in the driver's mobile bottom bar and in the
desktop header.

### No confirmation anywhere

None of the six logout entry points in the app asks anything first:

| # | Location | Current behaviour |
|---|---|---|
| 1 | `src/app/map/MapOverlays.tsx` — mobile bottom bar | One tap ends the session |
| 2 | `src/app/map/MapOverlays.tsx` — desktop name card | One tap ends the session |
| 3 | `src/app/operator/OperatorHeader.tsx` — mobile bottom bar | One tap ends the session |
| 4 | `src/app/operator/OperatorHeader.tsx` — desktop header | One tap ends the session |
| 5 | `src/app/profile/page.tsx` — sidebar | One tap ends the session |
| 6 | `src/app/operator/profile/page.tsx` — header | One tap ends the session |
| 7 | `src/app/admin/page.tsx` — header | One tap ends the session |

An account name is never shown, so a shared device can end the wrong
session.

## Goals

1. The map screens carry no logout control at all.
2. Signing out lives in **Settings** on every role's profile page.
3. Every logout is confirmed by a dialog that names the account.
4. The dialog is keyboard- and screen-reader-safe.
5. No visual change to the rest of the app.

### Non-goals

- Changing what logout *does*. It still revokes the session server-side,
  clears the token from `localStorage` and returns to `/login`.
- A "stay signed in" option or a session list.
- Changing the theme toggle, which stays where it is.

## Design Language

The dialog follows the same rules as the rest of the app:

- Panel: `rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl`
- Icon chip: `flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500 dark:text-rose-400`
- Primary text: `text-[var(--foreground)]` — never hard-coded `text-white`
- Secondary text: `text-[var(--text-muted)]`
- Buttons: `rounded-full`; destructive uses `bg-rose-600 text-white`,
  neutral uses `bg-[var(--surface-strong)] text-[var(--foreground)]`
- Backdrop: `fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm`

## The Confirm Dialog

### Copy

```
        ( rose sign-out icon )

        Sign out of HATUD?

        You are logging out of Juan dela Cruz.
        Your session on this device will end.

        [ Cancel ]   [ Sign out ]
```

- The heading says what will happen.
- The second line names the account, exactly as the brief asked.
- The third line sets the expectation: the session ends, the account and its
  data are untouched.
- If the session has no name (should not happen), the email is used
  instead, and failing that the word "your account".

### Component

`src/components/LogoutDialog.tsx`

```tsx
interface LogoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}
```

It reads the account name and the `logout` action from `useAuth()`, so the
page only has to own `isOpen`.

### Behaviour

| Requirement | Implementation |
|---|---|
| Modal semantics | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby` |
| Keyboard dismissal | `Escape` closes the dialog and leaves the session alone |
| Focus on open | The **Cancel** button receives focus, so a stray `Enter` does not sign out |
| Focus on close | Focus returns to whatever was focused before the dialog opened |
| Focus trap | `Tab` and `Shift+Tab` cycle between Cancel and Sign out only |
| Scroll lock | `document.body` gets `overflow-hidden` while the dialog is open |
| Backdrop click | Clicking the backdrop closes the dialog, same as Cancel |
| Signing out | Confirm calls `logout()` from `useAuth()`, which revokes the session, clears the token and redirects to `/login` |

The destructive button is **not** autofocused — Cancel is. A dialog that
signs you out when you press Enter by reflex is the exact failure this
change exists to prevent.

## Placement

### Removed

| File | What is removed |
|---|---|
| `src/app/map/MapOverlays.tsx` | The Logout button in the mobile bottom bar, the Logout button in the desktop name card, and the `onLogout` prop |
| `src/app/operator/OperatorHeader.tsx` | The Logout button in the mobile bottom bar, the Logout button in the desktop header, and the `onLogout` prop |
| `src/app/profile/page.tsx` | The "Sign Out" button in the left sidebar |
| `src/app/operator/profile/page.tsx` | The "Sign Out" button in the page header |
| `src/app/map/page.tsx` | The `logout` binding passed to `MapOverlays` |
| `src/app/operator/map/page.tsx` | The `logout` binding passed to `OperatorHeader` |

### Added

| File | Where the logout goes |
|---|---|
| `src/app/profile/page.tsx` | The **Settings** tab — a dedicated "Account" block below the theme slider, holding a "Sign out" button |
| `src/app/operator/profile/page.tsx` | The **Settings** section in the right-hand aside, below the theme slider |
| `src/app/admin/page.tsx` | Unchanged position (a dedicated header, nothing else within reach), but now behind the same confirm dialog |

### How a user still gets out of the map

Removing the button must not strand anyone, so the way to Settings stays
obvious and is already in place:

| Screen | Path to Settings |
|---|---|
| Passenger map (mobile) | The name chip with the avatar in the bottom bar links to `/profile` |
| Passenger map (desktop) | The **Profile** button in the name card links to `/profile` |
| Driver map (mobile) | The name chip in the bottom bar links to `/operator/profile` |
| Driver map (desktop) | The **Profile** button in the header links to `/operator/profile` |

The theme toggle stays in the map bottom bars — it is not destructive, and
moving it would cost more than it gains.

## Mobile-First Rules

1. The dialog is `w-full max-w-md` with `p-4` page padding, so it never
   touches the screen edges on a 360px phone.
2. The two buttons sit side by side and wrap to a column below `sm:`.
3. Both buttons are at least 44px tall.
4. The body cannot scroll behind the dialog.
5. The destructive button is the right-hand one, matching the platform
   convention for the confirming action on iOS and Android.

## Acceptance Criteria

1. The passenger map contains no logout control, at any breakpoint.
2. The driver map contains no logout control, at any breakpoint.
3. The passenger profile page has exactly one logout control, inside
   Settings.
4. The driver profile page has exactly one logout control, inside Settings.
5. Tapping logout opens a dialog naming the signed-in account.
6. Cancel closes the dialog and leaves the session alive.
7. Escape closes the dialog and leaves the session alive.
8. Confirming ends the session and lands on `/login`.
9. `Escape` and `Tab` behave as specified, and focus returns to the trigger
   after the dialog closes.
10. The admin panel's logout is behind the same dialog.

## Implementation Checklist

- [x] `src/components/LogoutDialog.tsx` — the confirm dialog
- [x] `src/app/map/MapOverlays.tsx` — drop both logout buttons and the prop
- [x] `src/app/map/page.tsx` — stop passing `onLogout`
- [x] `src/app/operator/OperatorHeader.tsx` — drop both logout buttons and the prop
- [x] `src/app/operator/map/page.tsx` — stop passing `onLogout`
- [x] `src/app/profile/page.tsx` — move the sidebar sign-out into Settings
- [x] `src/app/operator/profile/page.tsx` — move the header sign-out into Settings
- [x] `src/app/admin/page.tsx` — put the existing logout behind the dialog
- [x] `README.md` — link to this document
- [x] Verified in a real browser, not a unit test — there is no DOM harness in
      this project, so the behaviour was driven through a headless Chromium
      against the dev deployment

## Verification

Driven in a headless Chromium at 390×844, against the dev deployment:

```
COMMUTER MAP logout buttons: []
commuter map bottom bar controls: ["Juan dela Cruz",""]
OPERATOR MAP logout buttons: []
operator map bottom bar controls: ["Roberto ReyesABC 123","","Online"]

PROFILE Settings tab logout buttons: [{"h":46,"text":"Sign out","visible":true}]
OPERATOR PROFILE logout buttons: [{"h":46,"text":"Sign out","visible":true}]

DIALOG: {"modal":"true","labelledBy":"logout-dialog-title",
         "describedBy":"logout-dialog-description",
         "text":"Sign out of HATUD?You are logging out of Juan dela Cruz.
                Your session on this device will end. You can sign back in at
                any time.CancelSign out"}
DIALOG focused element: Cancel

after Escape:        dialog=0 stillSignedIn=true focus=Sign out
after Cancel:        dialog=0 stillSignedIn=true
after backdrop click: dialog=0 stillSignedIn=true
after Confirm:       url=http://localhost:4944/login?redirect=%2Fprofile

OPERATOR DIALOG: ... You are logging out of Roberto Reyes. ...
ADMIN DIALOG:    ... You are logging out of Admin User. ...

PAGE_ERRORS=none
```

`tsc --noEmit`, `ultracite check`, 67 vitest tests and `next build` all pass.

## Notes For The Next Person

- The theme toggle deliberately stayed on the map bottom bars. It is not
  destructive, and it is the only way to flip the theme without leaving the
  ride screen.
- The name chip on the map bottom bar is now the only route to Settings from
  the map. Do not remove it when restyling the bar.
- `LogoutDialog` reads the account name and the `logout` action from
  `useAuth()` itself, so a page only has to own `isOpen`. Adding it to a
  new screen is one import and one piece of state.

