# Color Contrast Improvement Plan

## Problem Statement
White text on the bottom panel is difficult to read due to insufficient contrast with the background.

## Analysis

### Current Issues

#### Operator Page Bottom Panel (`/operator`)
1. **User Info Card (left side)**
   - Background: `bg-[var(--surface-muted)]/50` (semi-transparent)
   - Text: White (`text-white`)
   - Issue: White text on light gray background has poor contrast

2. **Online/Offline Toggle**
   - Online: `bg-emerald-500/20 text-emerald-400` - OK
   - Offline: `bg-slate-600/50 text-slate-300` - May need improvement

3. **Logout Button**
   - Background: `bg-rose-500/20`
   - Text: `text-rose-400`
   - Border: `border-rose-500/50` - OK

#### Commuter Page Bottom Panel (`/map`)
1. **User Info Card (left side)**
   - Background: `bg-[var(--surface-muted)]/50`
   - Icon: `text-sky-300`
   - Text: White (`text-white`)
   - Issue: White text on light gray background

2. **Logout Button**
   - Same as operator - OK

## Solution

### 1. Dark Background for User Info Cards
Use darker backgrounds to ensure white text is readable:

```
bg-slate-800 (dark gray background)
text-white (white text - high contrast)
border-sky-500/50 (subtle border)
```

### 2. Enhanced Button Colors

#### Profile Button (Commuter)
- Background: `bg-sky-600` (solid darker blue)
- Border: `border-sky-400`
- Text: `text-white`

#### Online/Offline Toggle
- Online: Darker green background `bg-emerald-600` with white text
- Offline: Darker slate background `bg-slate-700` with light gray text

### 3. Implementation Steps

1. **Operator Page (`src/app/operator/page.tsx`)**
   - Change user info card background from `bg-[var(--surface-muted)]/50` to `bg-slate-800`
   - Keep text as `text-white` (will now have good contrast)
   - Adjust online toggle colors for better visibility

2. **Commuter Page (`src/app/map/page.tsx`)**
   - Change user info card background to `bg-sky-700`
   - Change icon from `text-sky-300` to `text-white`
   - Ensure logout button has proper contrast

### 4. Color Values to Use

| Element | Background | Text Color | Border |
|---------|------------|------------|--------|
| Operator User Card | `bg-slate-800` | `text-white` | `border-sky-500/50` |
| Commuter User Card | `bg-sky-700` | `text-white` | `border-sky-400` |
| Online Toggle | `bg-emerald-600` | `text-white` | `border-emerald-400` |
| Offline Toggle | `bg-slate-700` | `text-slate-200` | `border-slate-500` |
| Logout Button | `bg-rose-600` | `text-white` | `border-rose-400` |

## Expected Result
- All text will meet WCAG AA contrast ratio (4.5:1 minimum)
- Buttons will be easily distinguishable
- User info cards will be clearly visible against the panel background
