# FIXOCT20 — Codebase Gap Analysis & Remediation Plan

**Log ID:** fixoct20
**Created:** 2026-10-20 13:31:09 PST (Tuesday)
**Author:** opencode (automated codebase audit)
**Scope:** `convex/` (Convex backend) + `src/` (Next.js 16 / React 19 / Capacitor static export)
**Baseline state:** `npx tsc --noEmit --incremental false` → **PASS (0 errors)** · `npm run check` → **201 errors, 5 warnings** (43 files)

---

## Status Legend

| Marker | Meaning |
|---|---|
| ⬜ | Not started |
| 🟡 | In progress |
| ✅ | Done |
| ⛔ | Blocked (needs decision) |

---

## Executive Summary

Typecheck is clean but the **authorization layer is applied inconsistently**. `convex/lib/withAuth.ts` provides
`requireAuth`, `requireRole`, `requireOwnership`, `requireOperatorOwnership`, `requireCommuterOwnership` — but a
majority of **queries are registered as public functions with no `sessionToken` argument at all**, so any client
can read PII (phone numbers, license numbers, live GPS, saved home addresses, the full user directory) and any
client can **destroy the entire database** by calling `seed:forceReset`.

Secondary themes: destructive dev tooling shipped as production code, client-supplied fare, resource leaks
(`watchPosition` / MapLibre never cleaned up), render-loop-inducing effect dependency churn, and 201 lint errors
that block the repo's own Ultracite gate.

**Highest-value single fix:** close `convex/seed.ts`'s public mutations and add `sessionToken` auth to the ~25
unauthenticated queries.

---

## P0 — CRITICAL: Unauthenticated Public Convex Functions

### P0-1 ⬜ `convex/seed.ts` — destructive public mutations

| Function | Line | Problem |
|---|---|---|
| `seed` | `convex/seed.ts:11` | Public mutation, zero args, zero auth |
| `clearAllRides` | `convex/seed.ts:240` | Public mutation, deletes every `rides` doc |
| `forceReset` | `convex/seed.ts:251` | Public mutation, deletes **sessions, loginAttempts, feedback, rides, operators, commuters, admins, users** |

`forceReset` then re-seeds an admin with **hardcoded credentials committed to git**:
`admin@hatud.com` / `123456789` (`convex/seed.ts:20`, `:288`), default users `password123` (`:21`).

`IMPLEMENTATION_PLAN.md:40,127` documents `npx convex run seed:forceReset` as a routine rollback command,
confirming it is expected to be reachable.

**Impact:** one HTTP request to the Convex deployment wipes production data and reinstalls a known-credential admin account.

**Fix:**
1. Change `mutation` → `internalMutation` in all three (they can no longer be called from a client).
2. Guard re-seeding behind `SEED_KEY` env var compared against an arg, for local dev only.
3. Remove `clearAllRides` / `forceReset` from `convex/` entirely and keep seeding as a one-off script outside the deployed bundle.
4. Rotate the seeded admin password; never commit plaintext default credentials.
5. Add `convex/seed.ts` to a documented "delete before production deploy" checklist.

---

### P0-2 ⬜ PII queries with no `sessionToken` (authz not wired in)

Every function below is a **public** `query` that accepts a client-supplied ID and returns it unconditionally.

#### `convex/rides.ts`

| Function | Line | Leaks |
|---|---|---|
| `getById` | 9 | any ride by ID |
| `listByCommuter` | 14 | any commuter's ride history: addresses, fares, distances |
| `listByOperator` | 23 | any operator's assigned rides |
| `listByStatus` | 32 | full rides table filtered by status |
| `listPending` | 49 | all pending rides |
| `listPendingWithCommuter` | 58 | all pending rides **+ commuter name/phone/email** |
| `getActiveByCommuter` | 76 | any commuter's live ride + GPS |
| `getActiveByOperator` | 95 | any operator's live ride |
| `getOperatorLocation` | 381 | live operator GPS for any ride |
| `getCommuterLocation` | 392 | live commuter GPS for any ride |

#### `convex/operators.ts`

| Function | Line | Leaks |
|---|---|---|
| `getByUserId` | 5 | phone, `licenseNumber`, `vehicleInfo`, `currentLocation` |
| `getById` | 14 | same as above |
| `getByLicense` | 19 | operator lookup by license number (brute-forceable) |
| `listAvailable` | 28 | roster of available drivers + live locations |

#### `convex/commuters.ts`

| Function | Line | Leaks |
|---|---|---|
| `getByUserId` | 5 | phone, email, `savedLocations` (home/work addresses) |
| `getById` | 14 | same as above |
| `getByEmail` | 19 | commuter profile lookup by email |

#### `convex/users.ts` — user directory enumeration

| Function | Line | Leaks |
|---|---|---|
| `getById` | 13 | email, phone, role (passwordHash is stripped ✔) |
| `getByEmail` | 18 | same, by email (unauthenticated lookup) |
| `getByPhone` | 29 | same, by phone |
| `listByRole` | 40 | **entire user table** for any role, e.g. `listByRole("admin")` → admin roster |
| `updateLastLogin` | 95 | ⚠️ **public unauthenticated mutation** — patches any user's `updatedAt`; also dead code (`auth.login` never calls it) |

#### `convex/admins.ts`

| Function | Line | Leaks |
|---|---|---|
| `getByUserId` | 5 | admin profile + permissions |
| `getById` | 14 | same |
| `getByEmail` | 19 | admin lookup by email |
| `listAll` | 28 | full admin roster |
| `hasPermission` | 97 | permission probe for any admin id |

#### `convex/feedback.ts`

| Function | Line | Leaks |
|---|---|---|
| `getById` | 5 | any feedback row |
| `getByRideId` | 10 | ratings + comments for any ride |
| `getByOperator` | 19 | full rating history for any operator |
| `getOperatorAverageRating` | 28 | same aggregate |

**Fix pattern (uniform):**
```ts
// BEFORE
export const listByCommuter = query({
  args: { commuterId: v.id("commuters") },
  handler: async (ctx, args) => await ctx.db.query("rides")...
});

// AFTER
export const listByCommuter = query({
  args: { sessionToken: v.string(), commuterId: v.id("commuters") },
  handler: async (ctx, args) => {
    await requireCommuterOwnership(ctx, args.sessionToken, args.commuterId);
    return await ctx.db.query("rides")...
  },
});
```
- `getById` / `getByUserId` / `getByEmail` variants → `requireAuth` + ownership comparison.
- Admin-only views (`listAll`, `listByRole("admin")`) → `requireRole(ctx, token, "admin")`.
- `users.updateLastLogin` → delete (dead) or `internalMutation`.

**Call sites to update after the server change:**
| File | Line | Query |
|---|---|---|
| `src/app/operator/page.tsx` | 49 | `listPendingWithCommuter` (no args, no token) |
| `src/app/operator/page.tsx` | 52-55 | `getActiveByOperator` |
| `src/app/operator/map/page.tsx` | 36 | `listPendingWithCommuter` |
| `src/app/operator/map/page.tsx` | 37-40 | `getActiveByOperator` |
| `src/app/Commuters/page.tsx` | 54 | `commuters.getByUserId` |
| `src/app/Commuters/page.tsx` | 60 | `rides.getActiveByCommuter` |
| `src/app/Commuters/page.tsx` | 66 | `operators.getById` |
| `src/app/Commuters/page.tsx` | 75 | `rides.getOperatorLocation` |
| `src/app/map/page.tsx` | (same set) | — |

---

### P0-3 ⬜ Session token handling

- `src/lib/authContext.tsx:51-65` — token stored in `localStorage["hatud_session_token"]`.
- `src/lib/authContext.tsx:54-60` — mirrored into `document.cookie` with **no `Secure` and no `HttpOnly`**
  (`HttpOnly` is impossible from JS). Biome flags both lines as `lint/suspicious/noDocumentCookie`.
- **Nothing anywhere reads that cookie** — it is write-only dead weight that widens the attack surface.
- Since every Convex call takes `sessionToken` as an explicit arg, `localStorage` is currently load-bearing.

**Fix (minimal, shippable now):**
1. Delete `setSessionCookie` / `clearSessionCookie` and their 4 call sites — removes both lint errors and the insecure cookie.
2. Keep `localStorage` (acceptable for a static-export/Capacitor build where there is no server) but add
   `SameSite` guidance + session TTL enforcement server-side (already present: `SESSION_TTL_MS`).
3. Document that moving to an `HttpOnly` cookie requires a server runtime (i.e. dropping `output: "export"`).

---

## P1 — Business-Logic Bugs

| # | Gap | Location | Fix |
|---|---|---|---|
| P1-1 ⬜ | **Client-supplied fare** — commuter can book any ride for ₱0. Prices are a hardcoded client array | `convex/rides.ts:125` (`fare: v.optional(v.number())`), `src/app/Commuters/page.tsx:86-103` | Compute fare server-side from `distance × rate table`; remove `fare` from `create` args |
| P1-2 ⬜ | **No double-booking guard** — `accept` never checks `isAvailable` or an existing active ride; an operator can accept N pending rides | `convex/rides.ts:207-236` | `if (operator.isAvailable === false) throw new Error("...")` + query for existing accepted/inProgress ride first |
| P1-3 ⬜ | **Cancel doesn't free the driver** — `isAvailable` stays `false` forever after a cancel | `convex/rides.ts:238-269` | Patch the assigned operator back to `isAvailable: true` when cancelling |
| P1-4 ⬜ | **3-day message retention is a no-op for active rides** — cutoff is `now + RETENTION`, so the filter matches everything | `convex/messages.ts:84-88`, `:176-181` | Only apply `cutoffTime` when the ride has ended |
| P1-5 ⬜ | **`convex/theme.ts` re-implements session resolution** instead of using `requireAuth` — drift risk | `convex/theme.ts:6-21`, `:31-43` | Import `requireAuth` from `./lib/withAuth` |
| P1-6 ⬜ | **Sessions never garbage-collected** — expired rows accumulate forever | `convex/schema.ts:141` (`sessions`) | Add a daily cron via `ctx.scheduler` deleting `expiresAt < Date.now()` |
| P1-7 ⬜ | **`loginAttempts.count` never resets after lock expiry** — user re-locks on the 10th attempt hours later | `convex/auth.ts:109-135` | Reset `count` when `lockedUntil < now` |
| P1-8 ⬜ | **`login` never records last-login** and `users.updateLastLogin` is unreachable | `convex/auth.ts:292-315`, `convex/users.ts:95` | Patch `users.updatedAt` in `login`; delete the public mutation |

---

## P2 — Client Correctness & Performance

| # | Gap | Location | Fix |
|---|---|---|---|
| P2-1 ⬜ | **`watchPosition` never cleared; `map.remove()` never called** — every navigation mount adds another GPS watcher + live MapLibre instance (battery drain, memory leak, runaway mutation traffic) | `Commuters/page.tsx:144`, `operator/page.tsx:112`, `operator/map/page.tsx:137` | Store the watch id in a ref; `clearWatch(id)` + `map.current?.remove()` in the effect cleanup |
| P2-2 ⬜ | **Marker rebuild on every render** — `addCommuterMarkers` and `resetBooking` are recreated each render and sit in effect dep arrays, so effects fire on every render and tear down/re-add all markers | `operator/page.tsx:130` + `:188`, `operator/map/page.tsx:286` + `:342`, `Commuters/page.tsx:176` + `:216` | Wrap in `useCallback`, or move the function inside the effect body |
| P2-3 ⬜ | **`_allRides` dead subscription** — streams the entire rides table into the admin's browser on every page load | `admin/page.tsx:36-39` | Delete the line |
| P2-4 ⬜ | **Queries fire before auth resolves** (no token / no `"skip"`) | `operator/page.tsx:49,52`, `operator/map/page.tsx:36,37` | `sessionToken ? { sessionToken, ... } : "skip"` |
| P2-5 ⬜ | **State written but never read** → extra render per event | `ChatBubble.tsx:38,62` (`_messageCount`), `Commuters/page.tsx:84` (`currentLocation`), `operator/map/page.tsx:59,142` (`_driverLocation`) | Delete; `locationRef` is the real source of truth |
| P2-6 ⬜ | **`useTheme()` called inside try/catch** — genuine rules-of-hooks violation (biome `useHookAtTopLevel`) | `ThemeToggle.tsx:10-16` | Delete the try/catch; `ThemeProvider` is always mounted in `layout.tsx:37` |
| P2-7 ⬜ | **`setState` during render** | `ThemeSlider.tsx:11-13` | Remove the local `mounted` state (provider already gates) or use `useEffect` |
| P2-8 ⬜ | **Optimistic `setOnline` never reverts** if the mutation rejects | `operator/page.tsx:199-207` | `try/catch` → revert + `toast.error(...)` |
| P2-9 ⬜ | **`markAsRead` fires on every message change**, even with the chat bubble closed | `ChatBubble.tsx:60-69` | Gate on `isOpen` and on presence of unread partner messages |
| P2-10 ⬜ | **`flyTo` on every GPS sample** — camera never settles | `operator/page.tsx:120`, `operator/map/page.tsx:147` | Fly once on first fix, then only move the marker |
| P2-11 ⬜ | **Nominatim query not URL-encoded** in one page while `mapClient.ts:8` does it correctly → inconsistent search results | `Commuters/page.tsx:367,393` | Call `searchPlace()` from `src/lib/mapClient.ts` instead of re-implementing `fetch` |
| P2-12 ⬜ | **`innerHTML` assignment** (banned by AGENTS.md) | `operator/page.tsx:151,172`, `operator/map/page.tsx:305,325` | `el.textContent = "📍"` |
| P2-13 ⬜ | **`/Commuters` is effectively dead** — its own role guard redirects commuters to `/map`; the two pages are near-duplicates (28 KB / 32 KB) with duplicated booking flow, marker code and location heartbeat | `Commuters/page.tsx:167-173`, `map/page.tsx` | Delete `/Commuters`, keep `/map` (or vice-versa), extract shared hooks |
| P2-14 ⬜ | **Login drops the deep link** — `RouteGuard` sends `?redirect=`, login ignores it | `RouteGuard.tsx:34`, `login/page.tsx:20-27` | Read `useSearchParams().get("redirect")` and prefer it over the role default |
| P2-15 ⬜ | **`RouteGuard` renders `null` while auth resolves** → white-screen flash; no `error.tsx` / `loading.tsx` anywhere in `src/app/` | `RouteGuard.tsx:40-42` | Render a spinner; add `src/app/error.tsx` + `src/app/loading.tsx` |
| P2-16 ⬜ | **`/payment` and `/feedback` are 100% mocked** — zero `useQuery` calls, no ride context, reachable by any logged-in user via `RouteGuard` | `src/app/payment/page.tsx`, `src/app/feedback/page.tsx` | Wire to `api.rides.getActiveByCommuter` / `api.feedback.create`, or remove the routes |
| P2-17 ⬜ | **Three parallel auth fences** (RouteGuard + per-page `router.push` + login redirect) — an operator can briefly render commuter pages before their profile resolves | `RouteGuard.tsx`, every page effect | Single `<RequireRole role="operator">` wrapper |

---

## P3 — Instant Mechanical Cleanups

| # | Gap | Location | Fix |
|---|---|---|---|
| P3-1 ⬜ | **`NEXT_PUBLIC_CONVEX_URL` is declared nowhere in `env.js`** → `convexConfig.ts:1` silently falls back to `""` and `convexClient.tsx:10` throws at **import time** = blank page with no build error | `src/env.js:18-20,26-29`, `src/lib/convexConfig.ts:1`, `src/lib/convexClient.tsx:10` | Add `NEXT_PUBLIC_CONVEX_URL: z.string().url()` to `client` and `runtimeEnv` in `src/env.js` |
| P3-2 ⬜ | **23 `alert()` calls** while a `ToastProvider` is already mounted in the root layout | `login:121,128`, `admin:59,63,268,275,390,413`, `operator/page:195,222`, `operator/map:356`, `payment:20,24,63`, `Commuters/profile` ×8, `operator/profile:408` | Replace with `useToast()` from `src/components/Toast.tsx` |
| P3-3 ⬜ | **13 `noExplicitAny`** | `Commuters/page.tsx:35-36` (`any[]` suggestion lists), `convex/users.ts:9`, `convex/auth.ts:313,366` | Type the Nominatim response; drop `as any` in favor of narrowing |
| P3-4 ⬜ | **7 `noLabelWithoutControl`** — icon-only buttons with no label | `login/page.tsx:119-132` (Google/Facebook), `payment/page.tsx:141,154,166`, `Commuters/profile/page.tsx:248,267,289,311` | Add `aria-label`, or wrap in a real `<button>`/`<label>` |
| P3-5 ⬜ | **4 `noArrayIndexKey`** | `Commuters/page.tsx:531,556` + 2 more | Use Nominatim `place_id` / ride `_id` |
| P3-6 ⬜ | **1 `noSvgWithoutTitle`** | `map/page.tsx:525` | Add `<title>` |
| P3-7 ⬜ | **201 lint errors, most auto-fixable** (58 `useButtonType`, 23 `noAlert`, 15 `useFilenamingConvention`, 13 `noExplicitAny`, 9 `noNestedTernary`, 8 `useExhaustiveDependencies`, 6 `noNonNullAssertion`, 5 `noUnusedVariables`, 4 `noCognitiveComplexity`, 4 `noBitwiseOperators`, 4 `useTopLevelRegex`, 5 `noForEach`, 3 `useNumericSeparators`, …) | whole repo | `npm exec -- ultracite fix` — decide whether to adopt or disable `useFilenamingConvention` (kebab-case rename of 15 files vs. a biome.jsonc override) |
| P3-8 ⬜ | **Dead code: 6 exported interfaces in `convexConfig.ts`, all unreferenced, and 4 of them contradict the schema** (`ConvexRide.status: "requested" \| "active"` vs real `pending \| accepted \| inProgress \| completed \| cancelled`; `ConvexUser.lastLoginAt` doesn't exist) | `src/lib/convexConfig.ts:12-74` | Delete all six |
| P3-9 ⬜ | **Zero tests** despite `playwright` being a devDependency | repo-wide | Add `convex-test` unit tests for `withAuth` + a Playwright smoke test on `/login` |
| P3-10 ⬜ | **`README.md` is still create-next-app boilerplate**; 5 stale planning docs at root; `CHAT_IMPLEMENTATION_PLAN.md` references a deleted `src/middleware.ts` | `README.md`, `CHAT_IMPLEMENTATION_PLAN.md`, `FLASK_IMPLEMENTATION_PLAN.md`, `MOBILE_PACKAGING_PLAN.md` | Rewrite README (setup, env vars, seed, deploy, Capacitor flow); archive or delete stale plans |
| P3-11 ⬜ | **Hardcoded external endpoints scattered across 6 files** (OpenFreeMap tiles, Nominatim, OSRM router) | `Commuters/page.tsx:110,367,393`, `operator/page.tsx:90-91`, `operator/map/page.tsx:115-116`, `map/page.tsx:117-118`, `src/lib/mapClient.ts:24` | Extract to `src/lib/mapConfig.ts`; optional User-Agent/Referer per Nominatim's usage policy |

---

## Recommended Execution Order

1. **P0-1** — `convex/seed.ts` public mutations (one file, minutes, catastrophic-if-shipping)
2. **P0-2** — add `sessionToken` + `require*` to the ~25 public queries, then update the 9 call sites
3. **P0-3** — drop the insecure cookie mirror
4. **P1-1 → P1-4** — fare, double-booking, cancel-frees-driver, message retention
5. **P2-1 → P2-4** — geolocation/map cleanup, `useCallback` churn, `_allRides`, query gating
6. **P3-7** — `ultracite fix` sweep (clears ~120 of the 201 errors)
7. **P3-1 → P3-6** — env validation, toasts, a11y
8. **P2-13, P2-16** — decide on deleting `/Commuters` and whether `/payment` + `/feedback` get wired or removed
9. **P3-8 → P3-11** — dead code, tests, docs

---

## Open Decisions

| Question | Blocks |
|---|---|
| Keep `output: "export"` (Capacitor static export) or move to a Node runtime? | P0-3 (HttpOnly cookies), P3-1 |
| Delete `/Commuters` or `/map`? | P2-13 |
| Wire `/payment` + `/feedback` to Convex, or remove them? | P2-16 |
| Adopt biome's kebab-case filename rule (15 renames) or override it? | P3-7 |
| Where does seed data belong outside the deployed bundle? | P0-1 |

---

## Log

| Timestamp (PST) | Entry |
|---|---|
| 2026-10-20 13:31:09 | Initial audit created. tsc clean; ultracite check 201 errors / 5 warnings. 3 P0, 8 P1, 17 P2, 11 P3 gaps recorded. |