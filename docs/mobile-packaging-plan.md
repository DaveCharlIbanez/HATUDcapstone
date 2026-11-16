# The Mobile Packaging — Implementation Plan

**Log ID:** `fixoct42`
**Created:** 2026-11-03 13:20 PST (Tuesday)
**Status:** ✅ Executed
**Result:** `HATUD-v1.3-debug.apk` built · `versionCode 4` / `versionName 1.3` · signed with the same key as v1.2 · 114 payload files · 0 errors · 255 tests passing
**Related log:** [`FIXOCT42.md`](../FIXOCT42.md) at the repository root
**Previous:** [`FIXOCT41.md`](../FIXOCT41.md) (`fixoct41`)

---

## Overview

The Android build had to be repackaged with everything that landed since it
was last built — the payment modality, the live route, the ETA, the operator's
panels, the single ride type, and the crash on leaving the map.

Two things had to be right about it: **the web payload inside it is the
current build**, and **it installs over the build already on people's phones**.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| The build type | **Debug** | The release build type has no signing configuration and there is no keystore in the repository. The APK already in circulation is a debug one |
| The version | **`versionCode 4`, `versionName 1.3`** | Android refuses an upgrade whose code is not higher than the one it already has |
| The signing key | **The existing debug key** | A different key means `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, and the app's data is lost with the uninstall |
| The build command | **One script** — `npm run mobile:apk` | Three commands in the README is three chances to get it wrong |

---

## The toolchain

Two things were missing from the environment, and both turned out to be
present:

| Needed | Found |
|---|---|
| A JDK 17 or newer — Android Gradle Plugin 8.13 will not run on an older one | **Homebrew's `openjdk@21`** at `/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`. The machine's default was JDK 11 |
| The Android SDK | **Already installed** at `/opt/homebrew/share/android-commandlinetools`, with `platforms/android-36` and `build-tools/36.0.0`, and the licences accepted. `android/local.properties` already pointed at it |

So the APK **could** be built here after all.

---

## Work Breakdown

### Wave 1 — The metadata ✅

| # | Task | File |
|---|---|---|
| 1.1 | `versionCode` 3 → 4, `versionName` 1.2 → 1.3 | `android/app/build.gradle` |

### Wave 2 — The build ✅

| # | Task | File |
|---|---|---|
| 2.1 | The web build and the sync | `npm run mobile:build` |
| 2.2 | One command for the whole thing | `package.json` — `mobile:apk` |
| 2.3 | The toolchain, the signing key and the version rule, written down | `README.md` |

### Wave 3 — The verification ✅

| # | Check |
|---|---|
| V1 | The badging: the application id, the version, the SDK levels, the permissions |
| V2 | The signing certificate — **the same as the APK already on the phones** |
| V3 | The web payload inside the APK is byte-for-byte the current `out/` |
| V4 | The RSC payload files are all there — 114, the same as v1.2 |
| V5 | The fixes are really inside: the payment step, the ETA, the back button |
| V6 | The Priority ride is gone from the app code |

---

## Verification

```bash
npm run mobile:apk
```

**Result:** `BUILD SUCCESSFUL` · `android/app/build/outputs/apk/debug/app-debug.apk` · 5.2 MB.

| Check | Result |
|---|---|
| The badging | `com.hatud.app` · `versionCode 4` · `versionName 1.3` · minSdk 24 · targetSdk 36 |
| The permissions | Internet, coarse and fine location, camera |
| The signing certificate | `5221f521…32784` — **identical to v1.2** |
| The web payload | Matches the current `out/` — the only difference is Capacitor's own `cordova.js` |
| The RSC payload files | 114, the same as v1.2 |
| The fixes inside | *"How would you like to pay?"*, *"Time to your destination"*, *"Back to pickup and destination"* |
| The Priority ride | Gone from the app code — the three remaining matches are React's own `fetchPriority` |

---

## Risk

| Risk | Mitigation |
|---|---|
| The install fails over the top of the old build | The signing key is the same one, so it upgrades in place and the app's data survives |
| The device refuses the upgrade | `versionCode` is higher than the one it has |
| The APK carries an old web build | The payload is compared against `out/` byte for byte, and the fixes are looked for inside it |
| The build only works on this machine | The README now says exactly what it needs — a JDK 17+, the SDK, and where they are |
| The app points at the wrong backend | The bundle calls `sincere-peacock-519.convex.cloud`, the deployment the app is configured for |
