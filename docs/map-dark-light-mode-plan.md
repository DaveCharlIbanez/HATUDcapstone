# Map Dark/Light Mode - Complete Implementation Plan

## Overview
This document outlines the complete plan for implementing dark/light mode toggle that affects both the map visualization and the entire UI.

## Problem Statement
- Users need ability to switch between dark and light mode for better visibility in different lighting conditions
- The toggle should affect the entire application UI, not just isolated panels
- The map itself should switch between dark and light map styles

## User Requirements
1. Toggle button accessible in bottom navigation (mobile) and header (desktop)
2. Map style changes based on theme (dark map for dark mode, light map for light mode)
3. All UI elements adapt to the selected theme
4. Theme preference persists across sessions

## Technical Implementation

### 1. Theme System (Already Implemented)
- `ThemeContext` in `src/lib/themeContext.tsx`
- Theme state: `"light"` | `"dark"`
- Persists to localStorage and Convex backend
- CSS variables via `data-theme` attribute on `<html>` element

### 2. Theme Toggle Component
- `ThemeToggle` in `src/components/ThemeToggle.tsx`
- Uses sun/moon icons
- Calls `toggleTheme()` from context

### 3. Map Style Switching

#### Available Map Styles
| Mode | Style URL | Description |
|------|-----------|-------------|
| Dark | `https://tiles.openfreemap.org/styles/dark` | Dark theme map tiles |
| Light | `https://tiles.openfreemap.org/styles/bright` | Light/bright map tiles |

#### Implementation in Map Pages

**Pages requiring map style update:**
1. `src/app/map/page.tsx` (Commuter map)
2. `src/app/operator/page.tsx` (Operator dashboard)
3. `src/app/operator/map/page.tsx` (Operator map view)

**Code pattern:**
```tsx
const { theme } = useTheme();

useEffect(() => {
  const mapStyle = theme === "dark"
    ? "https://tiles.openfreemap.org/styles/dark"
    : "https://tiles.openfreemap.org/styles/bright";
  
  map.current = new maplibregl.Map({
    container: mapContainer.current,
    style: mapStyle,
    center: [122.0175, 10.7883],
    zoom: 13,
  });
}, [theme]);
```

### 4. UI Theme Adaptation

#### CSS Variables (via `data-theme`)
The application uses CSS custom properties that adapt based on theme:

**Light Theme (`data-theme="light"`):**
- `--background`: `#ffffff` or light gray
- `--foreground`: `#1a1a1a` or dark
- `--surface`: Light surface color
- `--surface-muted`: Muted light surface

**Dark Theme (`data-theme="dark"`):**
- `--background`: `#0f172a` or dark slate
- `--foreground`: `#f8fafc` or white
- `--surface`: Dark surface color
- `--surface-muted`: Muted dark surface

### 5. Bottom Navigation Button Styling

**Current Issue:**
Profile buttons have black background in light mode, making them invisible.

**Solution:**
- Use theme-aware colors with CSS variables
- Add visible borders/outlines for light mode
- Ensure buttons are always visible regardless of theme

**Implementation:**
```tsx
// For operator (commuter follows similar pattern)
className={`border-2 ${
  theme === "light" 
    ? "border-sky-500 bg-white text-slate-800"  // Light mode: white bg, dark text
    : "border-sky-400 bg-sky-700 text-white"     // Dark mode: dark bg, light text
}`}
```

## Implementation Status

| Task | Status |
|------|--------|
| ThemeContext setup | ✅ Complete |
| ThemeToggle component | ✅ Complete |
| Theme persistence | ✅ Complete |
| Map style switching | ✅ Complete |
| UI adaptation via CSS | ✅ Complete |
| Add toggle to mobile nav | ✅ Complete |
| Add toggle to desktop header | ⚠️ Not done yet |
| Profile button theme-aware | ❌ Need to fix |

## Files Modified

### Theme System
- `src/lib/themeContext.tsx` - Theme provider and hook
- `src/components/ThemeToggle.tsx` - Toggle button component

### Map Pages
- `src/app/map/page.tsx` - Commuter map with theme support
- `src/app/operator/page.tsx` - Operator dashboard with theme support
- `src/app/operator/map/page.tsx` - Operator map with theme support

## Next Steps
1. Fix profile button styling to be theme-aware
2. Optionally add ThemeToggle to desktop headers
3. Test all pages respond correctly to theme changes
4. Verify map style switches correctly

## Map Style Sources
OpenFreeMap provides free map tiles:
- Dark: `https://tiles.openfreemap.org/styles/dark`
- Bright: `https://tiles.openfreemap.org/styles/bright`
- Liberty: `https://tiles.openfreemap.org/styles/liberty`

Alternative providers if needed:
- CartoDB: Dark matter, Light all
- Stadia: Stadia Maps (requires API key)
- Mapbox: Requires API key
