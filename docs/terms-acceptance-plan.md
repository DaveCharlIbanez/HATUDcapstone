# Terms and Conditions Acceptance — Implementation Plan

**Log ID:** `fixoct29`
**Created:** 2026-10-28 01:20 PST (Wednesday)
**Status:** ✅ Executed — all four waves complete
**Result:** `tsc` 0 errors · `ultracite check` 0 errors · 130 tests passing · `next build` OK
**Related log:** [`FIXOCT29.md`](../FIXOCT29.md) at the repository root
**Previous:** [`docs/ride-completion-and-mobile-location-plan.md`](ride-completion-and-mobile-location-plan.md) (`fixoct28`)

---

## Overview

Before an account is created, a **Terms and Conditions** dialog opens. The
passenger or driver reads the document, scrolls to the end, ticks a checkbox
that only becomes available once they have reached the bottom, and presses
*I agree*. Until they do, no account is created.

The dialog is a centred card, not a full-screen page, and it is built from the
project's own theme tokens so it looks like the rest of the app in both light
and dark mode. The document itself is scrollable; the header and the footer
stay put.

Two things make this more than a form field:

1. **The gate is on the server.** `auth.signup` refuses a request that does not
   carry the acceptance. A checkbox that only exists in the browser is one
   line of `curl` away from being bypassed, and an acceptance that was never
   recorded is worth nothing if it is ever disputed.
2. **The document is data, not markup.** The terms live in `src/lib/terms.ts`
   as structured sections, so they can be versioned, tested, and shown again
   later from the profile page — where the app already has a "Terms of Service"
   button that does nothing.

---

## Problem Statement

| # | Problem | Detail |
|---|---|---|
| 1 | Nothing tells a new user what they are agreeing to | `convex/auth.ts` `signup` takes a name, an email, a phone and a password. There is no terms, no waiver, and no record of either. |
| 2 | There is no liability position | The user agreement says nothing about who is responsible for what happens during a trip. |
| 3 | A client-only gate is not a gate | Even once the dialog exists, `auth.signup` would still accept a call with no acceptance. |
| 4 | The document cannot be re-read | `src/app/profile/page.tsx:567` has a "Terms of Service" button that only raises *"Terms of service coming soon."* |
| 5 | The dialog must not fill the screen | The requirement is a sized card over the page, not a full-page replacement. |
| 6 | The checkbox must be earned | Ticking it has to mean the document was actually read to the end. |
| 7 | The gate can deadlock | A document shorter than the box has nothing to scroll. A naive "must scroll to the bottom" rule would make signup impossible. |
| 8 | It has to work on a keyboard | The document is long. Reaching the end with the keyboard has to be possible. |

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Where the text lives | `src/lib/terms.ts`, as structured sections | It can be versioned, tested and rendered again. A JSX blob cannot. |
| The dialog's shape | The `LogoutDialog` pattern, extended | The project already has a modal, a focus trap, a backdrop and a theme. A second pattern is a second thing to get right. |
| Where the gate opens | The step that actually creates the account, for both roles | "Right before creating the account" — a driver's details step does not create anything, so the dialog opens on the vehicle step. |
| The scroll rule | A pure `isScrolledToEnd`, with a 32 px tolerance | Testable, and a touch of overscroll at the end must not lock anyone out. |
| A document that fits | The gate opens immediately | There is nothing to scroll. Requiring a scroll that cannot happen would make signup impossible. |
| Server enforcement | `signup` rejects a request without `acceptedTerms` | The only gate that cannot be walked around. |
| Recording the acceptance | `acceptedTermsAt` and `acceptedTermsVersion` on the user | Evidence of what was accepted, and of which version, for the day it matters. |
| Cancelling | The form keeps everything; nothing is created | The dialog is not a dead end, and a mis-tap costs nothing. |
| Re-opening | The scroll position and the checkbox reset | The document has to be read again. |
| The liability clause | A new section 15 | It belongs with the rest of the terms, not in a separate document. |

### Non-goals

* A privacy policy, a cookie notice, or a marketing consent screen. One gate,
  one document.
* Asking an existing user to accept a revised version. The version is recorded
  so that it *can* be asked for later; the mechanism is not built now.
* A "remember my acceptance" checkbox across signups. The acceptance is
  specific to creating an account.

---

## Goals

1. No account can be created without the terms being accepted, on either side
   of the wire.
2. The dialog is a sized, themed card that never fills the screen.
3. The document scrolls; the checkbox only unlocks at the end.
4. The acceptance is recorded, with the version that was accepted.
5. The terms can be read again later, from the profile page.

---

## Architecture

### 1. The document — `src/lib/terms.ts` (new)

The terms as data, so they can be rendered, tested and versioned.

```ts
export interface TermsSection {
  heading: string;
  /** Bullet points, when the section is a list of duties. */
  bullets?: string[];
  paragraphs: string[];
}

export interface TermsDocument {
  /** The sentence the tick box agrees to. */
  agreement: string;
  /** The label on the tick box. */
  checklist: string;
  introduction: string;
  sections: TermsSection[];
  title: string;
  /** "1.0" — recorded on the user when the terms are accepted. */
  version: string;
}

export const TERMS_VERSION = "1.0";
export const TERMS: TermsDocument = { … };
```

The fourteen sections the user supplied, verbatim, plus:

**15. Limitation of Liability** (new)

> HATUD provides the platform and the technology that connect passengers with
> drivers within the designated service area. HATUD is not a party to the
> transportation arrangement between any passenger and any driver, and HATUD is
> not liable and is not accountable for any outcome, loss, damage, injury,
> delay, inconvenience, or event of any kind that occurs during the use of the
> application, whether arising from the acts or omissions of a passenger, a
> driver, or any third party, or from the operation of the platform itself.
>
> To the fullest extent permitted by applicable law, HATUD shall not be liable
> for any direct, indirect, incidental, special, consequential, exemplary, or
> punitive damages, or for any loss of profit, revenue, data, or goodwill,
> arising out of or in connection with the use of, or the inability to use, the
> application. This includes, without limitation, the availability or
> non-availability of a driver, a delay in matching a passenger with a driver,
> a cancellation by either party, a dispute between a passenger and a driver,
> the conduct of any user of the platform, and any inaccuracy or unavailability
> of the information, maps, or location data the platform provides.
>
> Users acknowledge that the availability of drivers, the safety of any
> journey, and the fulfilment of any booking request are matters outside
> HATUD's control, and agree to hold HATUD harmless to the fullest extent
> permitted by applicable law.

The document keeps the register of the sections the user supplied: plain, third
person, and addressed to "Users".

> **This is a draft written for the project, not legal advice.** It should be
> read by someone qualified before the app is used in anger.

### 2. The scroll gate — `src/lib/scroll.ts` (new)

The rule that unlocks the tick box, as a pure function so it can be tested
without a browser.

```ts
/** How close to the end counts as the end. */
export const SCROLL_END_TOLERANCE_PX = 32;

export function isScrolledToEnd(metrics: {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}): boolean {
  const { clientHeight, scrollHeight, scrollTop } = metrics;

  // There is nothing to scroll. Requiring a scroll that cannot happen would
  // make the tick box impossible, and therefore signup impossible.
  if (scrollHeight <= clientHeight + 1) {
    return true;
  }

  return scrollTop + clientHeight >= scrollHeight - SCROLL_END_TOLERANCE_PX;
}
```

### 3. The focus trap — `src/lib/focusTrap.ts` (new)

`LogoutDialog` already has a working `trapFocus`. It is lifted out and
generalised, because the terms dialog has a tick box and a scrollable region
as well as buttons:

```ts
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function trapFocus(event: KeyboardEvent, panel: HTMLElement | null): void;
```

`LogoutDialog` imports it and loses its private copy.

### 4. The dialog — `src/components/TermsDialog.tsx` (new)

Built on the `LogoutDialog` pattern:

| Part | The pattern it follows |
|---|---|
| Overlay | `fixed inset-0 z-[100] flex items-center justify-center p-4` |
| Backdrop | A `<button aria-label="Close the terms dialog">` with `bg-black/60 backdrop-blur-sm` |
| Panel | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby` |
| Escape | Closes, and leaves the form alone |
| Body scroll | `document.body.style.overflow = "hidden"` while open |
| Focus | Trapped while open, restored to the trigger on close |
| Theme | `bg-[var(--surface)]`, `text-[var(--foreground)]`, `text-[var(--text-muted)]`, `border-[var(--border)]` |

The panel is taller than the logout dialog, because the document has to fit:

```
┌────────────────────────────────────┐
│ Terms and Conditions          [×]  │  pinned
│ Version 1.0 · 28 October 2026      │
├────────────────────────────────────┤
│                                    │
│   1. Use of the Application        │
│   …                                │  scrolls
│   15. Limitation of Liability      │
│                                    │
├────────────────────────────────────┤
│ ☐ I have read and agree to the …   │  pinned
│ Scroll to the end to continue      │
│ [Not now]        [I agree]         │  pinned
└────────────────────────────────────┘
```

| Decision | Value | Why |
|---|---|---|
| Width | `max-w-lg` (32 rem) | Wider than the logout dialog, still well short of the screen |
| Height | `max-h-[85dvh]` | Leaves the bottom nav and the status bar visible |
| Layout | `flex flex-col`, the body `flex-1 overflow-y-auto` | The header and footer never scroll away |
| The document | A `<section tabIndex={0} aria-label="Terms and Conditions">` | A scrollable region has to be reachable by keyboard, so the End key works |
| The tick box | A real `<input type="checkbox">` with a `<label>` | Not a styled `<div>` — it has to be focusable and announced |
| The tick box, locked | `disabled` plus a visible hint | A disabled control with no explanation is a dead end |
| The primary button | `bg-sky-500`, `disabled` until the box is ticked | The project's accent, as on the signup form |

**The gate, in the component:**

```ts
const [hasReachedEnd, setHasReachedEnd] = useState(false);

const handleScroll = (event: UIEvent<HTMLElement>) => {
  const element = event.currentTarget;
  if (isScrolledToEnd({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  })) {
    setHasReachedEnd(true);
  }
};
```

The gate is also re-checked when the box is laid out and when it resizes, so a
document that fits — or a phone that rotates — never leaves the tick box
locked:

```ts
useEffect(() => {
  const element = bodyRef.current;
  if (!element) {
    return;
  }
  const check = () => {
    if (isScrolledToEnd({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
    })) {
      setHasReachedEnd(true);
    }
  };
  check();
  const observer = new ResizeObserver(check);
  observer.observe(element);
  return () => observer.disconnect();
}, [isOpen]);
```

### 5. The signup flow — `src/app/signup/page.tsx`

The dialog opens on the step that creates the account, and the create is
blocked until the terms are accepted.

```ts
const [isTermsOpen, setIsTermsOpen] = useState(false);
/** Which step was waiting for the acceptance. */
const [pendingCreation, setPendingCreation] = useState<"details" | "vehicle" | null>(null);
```

| Step | What happens |
|---|---|
| **Details → Continue** (commuter) | Validate → open the dialog, `pendingCreation = "details"` |
| **Details → Continue** (driver) | Validate → go to the vehicle step. No account is created yet, so no dialog. |
| **Vehicle → Continue** (driver) | Validate → open the dialog, `pendingCreation = "vehicle"` |
| **Dialog: I agree** | Close the dialog, run the pending creation |
| **Dialog: Not now / Escape / backdrop** | Close the dialog, keep the form, create nothing |

```ts
const handleTermsAccepted = () => {
  const action = pendingCreation;
  setIsTermsOpen(false);
  setPendingCreation(null);
  if (action === "details") {
    void createAccount();
  } else if (action === "vehicle") {
    void createAccount();
  }
};
```

Both branches call `createAccount`; the distinction only exists so the
dialog knows which step it interrupted.

### 6. The server — `convex/auth.ts` and `convex/schema.ts`

**The schema** — two optional fields, so no backfill:

```ts
users: defineTable({
  // …
  /** When the terms were accepted, and which version. */
  acceptedTermsAt: v.optional(v.number()),
  acceptedTermsVersion: v.optional(v.string()),
})
```

**The mutation** — the acceptance is required, and recorded:

```ts
export const signup = mutation({
  args: {
    // …
    acceptedTerms: v.boolean(),
    acceptedTermsVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.acceptedTerms) {
      throw new Error("You must accept the Terms and Conditions to create an account");
    }
    // …
    const userId = await ctx.db.insert("users", {
      // …
      acceptedTermsAt: now,
      acceptedTermsVersion: args.acceptedTermsVersion ?? TERMS_VERSION,
    });
  },
});
```

The version constant is imported from the shared terms module so the client and
the server cannot disagree about which version is in force.

### 7. The client wrapper — `src/lib/authContext.tsx`

`SignupData` gains `acceptedTerms: boolean` and `acceptedTermsVersion?`, and
the `signup` function passes them straight through. The existing error
handling already turns a thrown mutation into a message, so a rejected
acceptance surfaces as *"You must accept the Terms and Conditions…"* on the
form.

### 8. Reading the terms later — `src/app/profile/page.tsx`

The "Terms of Service" button at `src/app/profile/page.tsx:567` opens the same
dialog in a **read-only** mode: the document scrolls, there is no tick box and
no *I agree* button, only *Close*. It fills a stub that currently says *"Terms
of service coming soon."*

---

## Work Breakdown

### Wave 1 — The content and the rules — ✅

| # | Task | File |
|---|---|---|
| 1.1 | The terms as structured data, with the liability section | `src/lib/terms.ts` ✅ |
| 1.2 | `isScrolledToEnd` and the tolerance | `src/lib/scroll.ts` ✅ |
| 1.3 | `trapFocus`, lifted out and generalised | `src/lib/focusTrap.ts` ✅ |
| 1.4 | `LogoutDialog` uses the shared trap | `src/components/LogoutDialog.tsx` ✅ |

### Wave 2 — The dialog — ✅

| # | Task | File |
|---|---|---|
| 2.1 | The panel: the scrollable document, the gated tick box, the footer | `src/components/TermsDialog.tsx` ✅ |
| 2.2 | The scroll gate, the resize re-check, and the reset when it re-opens | `src/components/TermsDialog.tsx` ✅ |
| 2.3 | The read-only mode for reading the terms later | `src/components/TermsDialog.tsx` ✅ |

### Wave 3 — The gate — ✅

| # | Task | File |
|---|---|---|
| 3.1 | The dialog opens on the step that creates the account; the create is blocked | `src/app/signup/page.tsx` ✅ |
| 3.2 | `signup` requires the acceptance and records it | `convex/auth.ts` ✅ |
| 3.3 | `acceptedTermsAt` and `acceptedTermsVersion` on the user | `convex/schema.ts` ✅ |
| 3.4 | The client wrapper passes the acceptance through | `src/lib/authContext.tsx` ✅ |
| 3.5 | The profile page's "Terms of Service" opens the dialog read-only | `src/app/profile/page.tsx` ✅ |

### Wave 4 — Verification — ✅

| # | Task | File |
|---|---|---|
| 4.1 | The document, the scroll gate and the dialog's structure | `tests/terms.test.ts` ✅ — 13 assertions |
| 4.2 | `signup` refuses a call without the acceptance | `tests/convex/terms.test.ts` ✅ |
| 4.3 | The acceptance is recorded with its version | `tests/convex/terms.test.ts` ✅ |
| 4.4 | `npm run typecheck` · `npm run check` · `npm test` · `npm run build` | — ✅ |

---

## Test Plan

| # | Assertion |
|---|---|
| T1 | The document has fifteen sections, and the fifteenth is the limitation of liability. |
| T2 | The document has an introduction, an agreement paragraph and a tick-box label. |
| T3 | The document carries a version. |
| T4 | `isScrolledToEnd` is true when the content fits — there is nothing to scroll. |
| T5 | `isScrolledToEnd` is false at the top of a long document. |
| T6 | `isScrolledToEnd` is true at the bottom of a long document. |
| T7 | `isScrolledToEnd` is true within the tolerance of the end. |
| T8 | `isScrolledToEnd` is false well short of the end. |
| T9 | The signup page opens the dialog and does not create an account until the terms are accepted. |
| T10 | `auth.signup` refuses a call without `acceptedTerms`. |
| T11 | `auth.signup` records `acceptedTermsAt` and `acceptedTermsVersion` on the user. |

---

## Verification

```bash
npm run typecheck        # tsc --noEmit
npm run check            # ultracite check
npm test                 # vitest run
npm run build            # next build
```

**Baseline before the fix:** `tsc` 0 errors · `ultracite check` 0 errors · 113
tests passing · `next build` OK.

**After the fix:** `tsc` 0 errors · `ultracite check` 0 errors · 130 tests
passing (113 + 17 new) · `next build` OK — 13 static routes prerender.

### What was built

| Plan item | Where it landed |
|---|---|
| The terms as data | `src/lib/terms.ts` — fifteen sections, the liability section included, with a version and an effective date. |
| The scroll rule | `src/lib/scroll.ts` — `isScrolledToEnd`, with the tolerance. |
| The focus trap | `src/lib/focusTrap.ts` — shared by the terms dialog and the logout dialog. |
| The dialog | `src/components/TermsDialog.tsx` — the `LogoutDialog` pattern, extended. |
| The gate, on the client | `src/app/signup/page.tsx` — the dialog opens on the step that creates the account. |
| The gate, on the server | `convex/auth.ts` — `signup` refuses a call without the acceptance, and records the version. |
| The record | `convex/schema.ts` — `users.acceptedTermsAt` and `users.acceptedTermsVersion`. |
| Reading the terms later | `src/app/profile/page.tsx` — the "Terms of Service" button opens the document read-only. |
| The lint exception | `biome.jsonc` — `noNoninteractiveTabindex` is off for the terms dialog, which has a scrollable region. |
| The tests | `tests/terms.test.ts` (13) and `tests/convex/terms.test.ts` (4). |

### One thing the plan did not foresee

`noNoninteractiveTabindex` is a heuristic, and it does not know that a
scrollable region has to be reachable with the keyboard. A line-positioned
`biome-ignore` does not survive the formatter moving the attribute, so the
rule is turned off for the one file that has a scrollable region, with the
reason recorded in `biome.jsonc`.

**Manual pass:** open `/signup`, fill the form, press *Continue*. The dialog
opens over the form, centred, in the app's theme. The tick box is greyed out
with *"Scroll to the end to continue."* Scrolling to the bottom enables it.
Ticking it enables *I agree*. Pressing *I agree* creates the account.
*Not now* closes the dialog with the form intact and creates nothing.

---

## Risk

| Risk | Mitigation |
|---|---|
| A short document leaves the tick box locked forever | `isScrolledToEnd` returns true when there is nothing to scroll, and it is re-checked on mount and on resize. |
| The gate is bypassed | The server refuses a signup without the acceptance. The tick box is a courtesy, not the control. |
| The dialog is unusable on a small phone | The card is capped at `max-w-lg` and `85dvh`; the body scrolls; the header and footer stay pinned. |
| The document cannot be reached with the keyboard | The scrollable region is a focusable `<section>`, so the End key and the arrow keys work. |
| The terms are legal text written by a developer | Flagged in the plan and in the log. It should be read by someone qualified before the app is used in anger. |
| The terms change and old acceptances are not re-asked | The version is recorded on the user, so a re-acceptance can be required later without a migration. |
| The focus trap is duplicated | It is lifted into `src/lib/focusTrap.ts` and shared, not copied. |
