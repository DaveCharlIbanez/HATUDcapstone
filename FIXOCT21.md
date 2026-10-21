# FIXOCT21 — Operator Routing, Chat Overlay and Operator Map Landmarks

**Log ID:** fixoct21
**Created:** 2026-10-21 09:24 PST (Wednesday)
**Author:** opencode (reported-issue remediation)
**Scope:** `src/app/operator/`, `src/app/map/`, `src/app/login/`, `src/components/`, `src/lib/mapMarkers.ts`
**Baseline:** `tsc` 0 errors · `npm run check` 0 errors · 49 tests passing · `npm run build` OK

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

Three issues were reported after testing the remediated build:

1. An operator signing in lands on `/operator` instead of `/operator/map`, and has to navigate to a
   second, separate map screen to do the same job.
2. On the passenger side, opening the chat bubble leaves the pre-plotted landmark markers painted
   **on top of** the chat panel.
3. On the operator side, the map shows no landmarks at all.

All three share a single underlying theme: **the passenger map and the operator map are two
near-duplicate implementations of the same screen, and they have drifted apart.** The drift is what
produced all three symptoms. The fix is therefore not three patches — it is to make the operator map
the single canonical operator screen and to put the shared map behaviour in one place.

| Issue | Root cause | Status |
|---|---|---|
| 1. Operator lands on `/operator` | `login`'s role→route map returns `operator`; `/operator` and `/operator/map` are separate pages | ✅ |
| 2. Landmarks over the chat panel | The map container is not a stacking context, so MapLibre markers escape into the root stacking context | ✅ |
| 3. No landmarks on the operator map | Landmark markers are only created in the passenger map's `useMapInstance` | ✅ |

---

## Issue 1 — Operator signing in lands on `/operator`, not `/operator/map`

### Symptom

After signing in as an operator the app navigates to `/operator`. The driver then has to open a
*different* screen, `/operator/map`, to work the same queue. The user's words: *"it made me have to
go to another map from the initial map."*

### Root cause

`src/app/login/page.tsx` maps a role to a landing path:

```ts
function routeForRole(role: string): string {
  if (role === "admin") { return "admin"; }
  if (role === "operator") { return "operator"; }   // ← lands on /operator
  return "map";
}
```

`/operator` and `/operator/map` are two independent pages, each ~650 lines, each with its own
MapLibre instance, its own pending-ride queue and its own chat bubble. They are the same screen
written twice — exactly the duplication that was already removed for `/Commuters` vs `/map` during
the fixoct20 remediation.

Two things made the drift visible:

- **The online/offline toggle only exists on `/operator`.** It is the switch that calls
  `operators.setAvailability`, i.e. the thing that actually makes a driver eligible for rides.
  On `/operator/map` a driver cannot go online at all.
- **The earnings panel only exists on `/operator`.**

Historically `/operator/map` was a secondary view, and the page carried its own role guard that
bounced operators back to `/operator`:

```ts
// Role guard - redirect operators to main /operator page to avoid duplication
if (user.role === "operator") { router.replace("/operator"); }
```

That guard was removed when the three parallel auth fences were consolidated into `RouteGuard`
(fixoct20 Wave 4). Its removal was correct — the point of that change was to have exactly one gate —
but it left `/operator` as the default landing page, and the two screens are not actually
equivalent.

### Fix

1. **Port the missing features onto `/operator/map`**: the online/offline toggle (reusing the
   already-extracted `OperatorHeader` component) and the earnings / rides-today panel.
2. **Land operators on `/operator/map`** directly, from `login` and from the home page.
3. **Retire `/operator` as a duplicate screen.** It is replaced by a thin client-side redirect to
   `/operator/map`, so every existing link (the header nav, the operator profile page, the "Back"
   button) keeps working and lands in the right place.
4. Point every remaining `/operator` reference at `/operator/map`.

The operator map is now the only operator screen, and it is a strict superset of what `/operator`
used to do.

---

## Issue 2 — Landmark markers paint on top of the chat panel

### Symptom

On the passenger map, opening the chat bubble leaves the pre-plotted landmark markers rendered
**over** the chat panel.

### Root cause

This is a CSS stacking-context problem, and it is not a "z-index is too low" problem — raising the
chat's z-index cannot fix it.

The passenger map's DOM is:

```jsx
<div className="relative h-screen w-full">              {/* root of the screen  */}
  <MapOverlays />                                        {/* fixed nav, z-30    */}
  <div className="h-full w-full" ref={mapContainer} />    {/* ← the map container */}
  <div className="pointer-events-none absolute bottom-0"> {/* ← the bottom sheet   */}
    …
    <ChatBubble />                                        {/* position: fixed, z-9999 */}
  </div>
</div>
```

MapLibre appends its markers to the map container, and the landmark marker element carries an
explicit `z-index: 10` (set in `useMapInstance`):

```ts
markerEl.style.zIndex = "10";
```

The map container is `position: relative` (from MapLibre's own `.maplibregl-map` rule) with
`z-index: auto`. **A positioned element with `z-index: auto` does not create a stacking context.**
So the marker, with `z-index: 10`, escapes the map and participates in the **root** stacking
context, where it paints in the "positive z-index" layer.

The chat bubble cannot escape in the opposite direction, because the bottom sheet that contains it
uses `backdrop-blur-xl`. **`backdrop-filter` creates a stacking context *and* makes the element a
containing block for `position: fixed` descendants.** The `ChatBubble` is `position: fixed` with
`z-index: 9999`, but because its containing block is the sheet, that 9999 is resolved *inside the
sheet's* stacking context — and the sheet itself is `z-index: auto`, so it paints in the
"positioned, z-index auto" layer, *below* the markers' 10.

Net result: the whole sheet, chat bubble included, is trapped underneath the landmark markers.

### Fix

Make the map container a stacking context, so the markers are contained inside the map and can
never paint over the UI:

```jsx
<div className="relative z-0 h-full w-full" ref={mapContainer} />
```

`position: relative` + `z-index: 0` **does** create a stacking context. The markers keep their
`z-index: 10` (still needed to sit above the map canvas, still fine now that it is contained), but
they are now painted inside the map's own box. The overlays — the bottom sheet, the header, the
nav — all paint above it as before.

This is applied to the passenger map and the operator map, which shared the same defect.

---

## Issue 3 — No landmarks on the operator map

### Symptom

The operator map renders the basemap and the driver marker, but none of the pre-plotted landmarks
(government offices, schools, hospitals, …) that the passenger map shows.

### Root cause

The landmark markers were never ported to the operator map. A repo-wide search for the landmark
data shows where it is used:

| File | Use |
|---|---|
| `src/app/map/useMapInstance.ts` | **Creates** the landmark markers |
| `src/app/map/LocationStep.tsx` | Renders the landmark picker list |
| `src/app/map/page.tsx` | Filters the landmark list by municipality |

`src/app/operator/map/page.tsx` appears in none of them. It builds its own MapLibre instance
inline and adds exactly one marker — the driver's own position:

```ts
userMarkerRef.current = new maplibregl.Marker({ element: driverEl })
  .setLngLat([122.0175, 10.7883])
  .addTo(map.current);
```

So this is not a bug in the marker code — the code was simply never called from the operator map.
The duplication between the two map screens let the landmark rendering exist in only one of them.

### Fix

Extract the landmark-marker creation into a shared helper and call it from both maps:

```ts
// src/lib/mapMarkers.ts
export function addLandmarkMarkers(
  map: maplibregl.Map,
  markers: maplibregl.Marker[]
): void
```

Both the passenger map (`useMapInstance`) and the operator map now call it, so the two screens
cannot drift on this again.

---

## Files changed

| File | Change |
|---|---|
| `src/lib/mapMarkers.ts` | New `addLandmarkMarkers` helper, shared by both maps |
| `src/app/map/useMapInstance.ts` | Use the shared helper; drop the duplicated marker code |
| `src/app/map/page.tsx` | Map container becomes a stacking context (`relative z-0`); operator redirect points at `/operator/map` |
| `src/app/operator/map/page.tsx` | Landmarks; online/offline toggle; earnings panel; map container stacking context; header replaced with `OperatorHeader` |
| `src/app/operator/page.tsx` | Deleted; replaced by a redirect to `/operator/map` |
| `src/app/login/page.tsx` | Operators land on `/operator/map` |
| `src/app/page.tsx` | Operators land on `/operator/map` |
| `src/app/operator/profile/page.tsx` | Links point at `/operator/map` |
| `src/components/HeaderClient.tsx` | Operator nav link points at `/operator/map` |
| `src/components/RouteGuard.tsx` | `/operator` prefix still covers `/operator/map` |

---

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run check` | 0 errors, 0 warnings |
| `npm test` | 49 passing |
| `npm run build` | 13 static routes prerender |
| Server changes | none — all three issues were client-side |
| Landmarks plotted | both maps call the shared `addLandmarkMarkers` |
| Map container stacking context | both maps use `relative z-0` |
| Operator landing route | `login` and the home page resolve to `/operator/map` |
| Operator features on the map | online toggle, earnings panel, ride queue, ride details, current ride, chat, landmarks |

---

## Log

| Timestamp (PST) | Entry |
|---|---|
| 2026-10-21 09:24 | Three issues reported. Root causes identified: duplicated operator screens, map container not being a stacking context, landmark markers never ported to the operator map. |
| 2026-10-21 09:31 | Fixes implemented: shared landmark helper, stacking-context fix on both maps, operator map ported with the online toggle and earnings panel, `/operator` retired as a redirect, all references repointed at `/operator/map`. |
| 2026-10-21 09:44 | Verification run: typecheck, lint, 49 tests and the production build all pass. |
