# Implementation Plan: Vehicle Types Simplification

**Date:** September 10, 2026  
**Goal:** Simplify vehicle types from 3 options to 2 (Standard, Priority)

---

## Current State

### Vehicle Types (3 options)
| Type | Name | Icon | Capacity | Price |
|------|------|------|----------|-------|
| `motorcycle_standard` | Standard | 🏍️ | 1 | ₱30 |
| `motorcycle_with_pillion` | With Pillion | 🛵 | 2 | ₱50 |
| `motorcycle_family` | Family | 🏍️ | 3 | ₱80 |

### Target State (2 options)
| Type | Name | Icon | Capacity | Price |
|------|------|------|----------|-------|
| `standard` | Standard | 🏍️ | 1 rider | ₱30 |
| `priority` | Priority | 🛵 | 2 riders | ₱50 |

---

## Implementation Steps

### Phase 1: Database Schema (Convex)

**Files:** `convex/schema.ts`, `convex/rides.ts`

1. Remove old vehicle type literals:
   - `motorcycle_standard` → replace with `standard`
   - `motorcycle_with_pillion` → replace with `priority`
   - `motorcycle_family` → remove entirely

2. Update validation in `convex/rides.ts` input schema

### Phase 2: Database Reset & Re-seed

**Command:** `npx convex run internal.seed.forceReset`

This will:
- Clear all existing rides
- Re-seed with new vehicle types (`standard`, `priority`)

### Phase 3: Frontend Logic

**File:** `src/app/Commuters/page.tsx`

1. Update `vehicles` array (lines 71-96):
   ```typescript
   const vehicles: Vehicle[] = [
     {
       type: "standard",
       name: "Standard",
       icon: "🏍️",
       eta: "2 min",
       capacity: 1,
       price: 30,
     },
     {
       type: "priority",
       name: "Priority",
       icon: "🛵",
       eta: "3 min",
       capacity: 2,
       price: 50,
     },
   ];
   ```

2. Update type assertion (lines 254-257):
   ```typescript
   vehicleType: selectedVehicle as "standard" | "priority",
   ```

### Phase 4: Operator UI

**Files:** 
- `src/app/operator/page.tsx`
- `src/app/operator/map/page.tsx`

1. Update fallback display for vehicle type (line 264, 357):
   - Change `"economy"` fallback to `"standard"`
   - Add display formatting: `vehicleType ?? "standard"`

### Phase 5: Seed Data

**File:** `convex/seed.ts`

Update all vehicle types in seed data:
- `motorcycle_standard` → `standard`
- `motorcycle_with_pillion` → `priority`
- `motorcycle_family` → remove

---

## UI Design (Current Theme: Dark)

### Commuter Vehicle Selection Card

```
┌─────────────────────────────────────┐
│  Select Vehicle                     │
├─────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐   │
│  │   🏍️       │  │    🛵       │   │
│  │  Standard  │  │   Priority  │   │
│  │  ₱30       │  │    ₱50      │   │
│  │  ~2 min    │  │    ~3 min   │   │
│  │  1 seat    │  │    2 seats  │   │
│  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────┘
```

**Styling:**
- Dark cards (#1e293b)
- Selected: Sky blue border (#0ea5e9)
- Hover: Slight scale + glow
- Text: Slate-100 for labels, sky-400 for prices

---

## Rollback Plan

If issues occur:
1. Run `npx convex run internal.seed.forceReset` again
2. Restore previous vehicle type literals in schema
3. Restore previous frontend code

---

## Success Criteria

- [ ] Schema accepts only `standard` and `priority`
- [ ] Seed data uses only new types
- [ ] Commuter UI shows 2 vehicle options
- [ ] Operator UI displays correct vehicle type
- [ ] Ride creation works with new types
- [ ] No console errors on ride booking
