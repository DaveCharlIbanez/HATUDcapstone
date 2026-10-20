# Mobile Packaging Plan — HATUD

Goal: package this existing **Next.js 16 + Convex** web app into an installable
mobile app. Backend stays on hosted Convex; only the frontend is wrapped.

---

## ▶ CURRENT STATUS — ✅ ANDROID APK BUILT

**Deliverable:** `dist/HATUD-debug.apk` (4.9 MB) — also at
`android/app/build/outputs/apk/debug/app-debug.apk`.
Package `com.hatud.app`, label "HATUD", minSdk 24 / targetSdk 36. Both paths are
gitignored (not committed).

### Toolchain installed on this machine (no sudo, all under /opt/homebrew)
- JDK 21: `brew install openjdk@21` → `JAVA_HOME=/opt/homebrew/opt/openjdk@21`
- Android SDK: `brew install --cask android-commandlinetools`
  → `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`
- SDK packages: `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`
  (licenses accepted via `yes | sdkmanager --licenses`)
- `android/local.properties` written with
  `sdk.dir=/opt/homebrew/share/android-commandlinetools`

### Rebuild the APK after any code change
```bash
npm run build            # regenerate static export into out/
npx cap sync android     # copy out/ into the native project
cd android
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools \
  ./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```
Tip: add `export JAVA_HOME=/opt/homebrew/opt/openjdk@21` and
`export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools` to `~/.zshrc`
so the env vars are always set.

### Install on an Android device
Enable "Install unknown apps" for your file manager/browser, transfer
`dist/HATUD-debug.apk` to the phone, tap to install. Or via USB with debugging on:
`adb install dist/HATUD-debug.apk`.

### Remaining (optional)
- **Runtime smoke test on a device/emulator** — the APK is built but hasn't been
  launched on hardware yet. Verify: login → role routing → map+GPS → logout
  against live Convex.
- **Phase 3 device polish** not yet applied: app icon/splash, geolocation plugin +
  `ACCESS_FINE_LOCATION` for MapLibre, Android back-button handling. See Phase 3.
- **Release build / signing** (for store distribution) — see Phase 5.
- **iOS** (Phase 6) — not started.

---

**Done & verified (Phases 0–4):**
- Fixed pre-existing type errors that silently broke `next build`:
  `convex/auth.ts` (indexed-access guards), `convex/seed.ts` (destructure +
  guard), and three pages importing `Id` from `convex/values` instead of
  `convex/_generated/dataModel` (`Commuters/page.tsx`, `operator/page.tsx`,
  `operator/map/page.tsx`). `npm run typecheck` is clean.
- `next.config.ts` → `output: "export"`. `npm run build` produces `out/` with
  all 14 routes prerendered as static. ✓
- Replaced server-only `src/middleware.ts` (can't run in static export) with a
  client `src/components/RouteGuard.tsx`, wired into `src/app/layout.tsx`.
- Deleted unused, server-only `src/lib/convexServer.ts` (used `convex/nextjs`,
  incompatible with static export, imported nowhere).
- Capacitor 8.4.1 installed (`@capacitor/core`, `/cli`, `/android`).
  `capacitor.config.ts` created — appId `com.hatud.app`, webDir `out`.
  `npx cap add android` scaffolded `android/`; web assets synced;
  `npx cap doctor android` → healthy.
- Added npm scripts: `mobile:build` (`next build && cap sync`) and
  `mobile:android` (`next build && cap sync android && cap open android`).

---

## Chosen approach: Capacitor (web → native shell)

**Why Capacitor over the alternatives:**

- **Capacitor (chosen):** wraps the existing web UI in a native WebView. Almost
  zero rewrite — all current React/Next pages, MapLibre maps, and Convex calls
  run as-is. Convex is already a hosted backend reached over the network, so the
  data layer needs no changes.
- React Native / Expo: best native feel, but requires rewriting every screen and
  the map layer. Too much work for a capstone-scale UI.
- PWA only: no app-store package, weaker device integration. Capacitor is a
  superset of this.

**Target OS:** Android first (no signing/Mac-toolchain friction, fastest to a
running `.apk`). iOS is the same flow with `npx cap add ios` and is optional —
do it after Android works. "Any OS is fine," so Android is the primary deliverable.

**Architecture after packaging:**

```
[ Capacitor native shell (Android/iOS) ]
        └─ WebView loads static Next.js export (out/)
                └─ Convex React client → hosted Convex deployment (network)
```

---

## Key constraints discovered in this codebase

1. **Static export required.** Capacitor serves static files. Next.js must build
   with `output: "export"`. `images.unoptimized` is already set in
   `next.config.ts` (good — required for export).
2. **`src/middleware.ts` will not run** in a static export. Its job (redirect
   unauthenticated users away from protected routes) must move to a **client-side
   route guard**. `src/lib/authContext.tsx` already exposes `user` / `isLoading`
   via `localStorage` + the Convex `getSession` query, so the guard is a thin
   wrapper — no backend change.
3. **Token auth already works in a WebView.** Auth lives in `localStorage`
   (`hatud_session_token`) and is validated reactively against Convex. The
   browser cookie was only used by middleware, so it becomes irrelevant on mobile.
4. **Convex URL must be a public env var** baked into the static build
   (`NEXT_PUBLIC_CONVEX_URL`). Confirm it points at the deployed Convex
   deployment, not a localhost dev URL, before building for device.
5. **No Next.js server features at runtime** (no API routes, no server actions,
   no dynamic SSR). Audit confirms the app is Convex-driven client components, so
   this is compatible — verify during Phase 1.

---

## Phase 0 — Prep & verification (no code changes yet)

- [ ] Confirm a Convex deployment exists and `NEXT_PUBLIC_CONVEX_URL` resolves to
      it (`.env.example` / `src/env.js`). Note the URL.
- [ ] `npm run build` to confirm the app currently builds clean.
- [ ] `grep -rn "app/api\|server actions\|use server"` to confirm there are no
      server-only runtime features that static export would break.
- [ ] Decide the app id (e.g. `com.hatud.app`) and display name ("HATUD").

## Phase 1 — Make the Next.js app static-export compatible

- [ ] Edit `next.config.ts`: add `output: "export"` (keep `images.unoptimized`).
- [ ] Replace middleware-based protection with a client guard:
      - Add `src/components/RouteGuard.tsx` that reads `useAuth()`; while
        `isLoading` show a splash/spinner; if no `user` on a protected route,
        `router.replace("/login?redirect=...")`.
      - Wrap protected route groups (`/admin`, `/operator`, `/Commuters`, `/map`,
        `/payment`, `/feedback`) with the guard (in their layout(s) or page tops).
      - Reuse the `PROTECTED_ROUTES` list currently in `src/middleware.ts`.
- [ ] Delete or neutralize `src/middleware.ts` (it is dead code in export builds;
      removing avoids confusion).
- [ ] Verify dynamic routes (if any) have `generateStaticParams`; this app's
      routes look static, so likely nothing to do.
- [ ] `npm run build` → confirm an `out/` directory is produced with no export
      errors. Open `out/index.html` in a browser and click through login + a
      protected page to confirm the client guard works.

## Phase 2 — Add Capacitor

- [ ] Install: `npm i -D @capacitor/cli && npm i @capacitor/core`.
- [ ] Init: `npx cap init "HATUD" "com.hatud.app" --web-dir=out`.
- [ ] Add Android platform deps + platform:
      `npm i @capacitor/android && npx cap add android`.
- [ ] Add a convenience script to `package.json`:
      `"mobile:build": "next build && npx cap sync"`.
- [ ] Run `npm run mobile:build` to copy `out/` into the native project.

## Phase 3 — Native config & device integrations

- [ ] App icon + splash: `npm i -D @capacitor/assets`, drop a 1024×1024 icon and
      splash into `assets/`, run `npx cap assets generate`.
- [ ] Status bar / safe areas: verify map and headers aren't under the notch; add
      `@capacitor/status-bar` if needed.
- [ ] **Location for maps:** add `@capacitor/geolocation` (MapLibre needs device
      GPS on mobile). Add `ACCESS_FINE_LOCATION` to
      `android/app/src/main/AndroidManifest.xml`. Wire the existing map code
      (`src/lib/mapClient.ts`, `/map` pages) to request permission via the plugin.
- [ ] Confirm network/cleartext: Convex is HTTPS, so no cleartext exception
      needed. Confirm the WebView can reach `NEXT_PUBLIC_CONVEX_URL`.
- [ ] Handle Android hardware back button (`@capacitor/app` `backButton` listener)
      so it navigates router history instead of closing the app.

## Phase 4 — Build & run on a device/emulator

- [ ] Open native IDE: `npx cap open android` (Android Studio).
- [ ] Run on emulator or USB device. Smoke-test: login, signup, role routing
      (commuter/operator/admin), map render + GPS, feedback, payment screen.
- [ ] Verify Convex realtime updates flow (e.g. a ride update reflects live).
- [ ] Confirm logout clears `localStorage` and returns to `/login`.

## Phase 5 — Produce a shippable package (the deliverable)

- [ ] Debug build (fastest, installable): in Android Studio
      *Build → Build APK*, or `cd android && ./gradlew assembleDebug`.
      Output: `android/app/build/outputs/apk/debug/app-debug.apk`.
- [ ] (Optional, for store/release) Generate a signing keystore, configure
      `signingConfigs` in Gradle, then `./gradlew assembleRelease` /
      `bundleRelease` for an `.aab`.
- [ ] Hand off the `.apk` as the "package for any OS" deliverable. Document the
      install step (enable "install from unknown sources", sideload the apk).

## Phase 6 — (Optional) iOS, if a second platform is wanted

- [ ] `npm i @capacitor/ios && npx cap add ios && npx cap sync`.
- [ ] `npx cap open ios`, set a development team in Xcode, run on simulator/device.
- [ ] Add `NSLocationWhenInUseUsageDescription` to `Info.plist` for the map.

---

## Definition of done

- `npm run mobile:build` produces `out/` and syncs it into the native project.
- App installs and launches on an Android emulator/device.
- Login → role-based protected routes → map with GPS → logout all work against
  the live Convex backend.
- A distributable `app-debug.apk` exists and its install steps are documented.

## Risks / watch-items

- **Static export breaks any server-only Next feature** — caught in Phase 0/1.
- **Client route guard must cover every protected route** or pages leak without
  auth; mirror `PROTECTED_ROUTES` exactly and test each.
- **Convex URL must be the deployed one** baked at build time, or the device app
  silently can't reach the backend.
- **MapLibre on mobile** may need the geolocation plugin + manifest permission to
  get a user location; browser geolocation won't prompt the same way in a WebView.
