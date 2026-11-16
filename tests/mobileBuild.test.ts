import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/**
 * The Android build.
 *
 * These are the things that only fail once the app is on a phone, where
 * nobody can run the test suite. The location permissions are the important
 * one: Capacitor's bridge asks Android for them when the WebView first asks
 * for a position, but a permission that is not declared in the manifest can
 * never be granted, so the request is dropped and the app never asks at all.
 */

const projectRoot = join(import.meta.dirname, "..");

function readProjectFile(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

test("the manifest declares the location permissions", () => {
  const manifest = readProjectFile("android/app/src/main/AndroidManifest.xml");

  expect(manifest).toContain("android.permission.ACCESS_FINE_LOCATION");
  expect(manifest).toContain("android.permission.ACCESS_COARSE_LOCATION");
});

test("the manifest keeps location optional, so the app installs without a GPS", () => {
  const manifest = readProjectFile("android/app/src/main/AndroidManifest.xml");

  expect(manifest).toContain("android.hardware.location");
  expect(manifest).toContain("android.hardware.location.gps");

  // Every optional feature has to say so, or a device without the hardware
  // is filtered out of the store listing.
  const optionalFeatures = manifest.match(
    /android:name="android\.hardware\.location[^"]*"[\s\S]{0,80}?android:required="false"/g
  );
  expect(optionalFeatures?.length).toBe(2);
});

test("the operator map has no chat toggle", () => {
  const page = readProjectFile("src/app/operator/map/page.tsx");

  // The chat appears on its own while a ride is live. A driver must not be
  // able to hide it from a passenger who is trying to reach them.
  expect(page).not.toContain("Chat {showChat");
  expect(page).not.toContain("setShowChat");
});
