import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/**
 * The location permission.
 *
 * Two questions hide behind "location", and the app has to tell them apart:
 * whether the permission was refused, and whether a position could be read.
 * Telling a user to change their settings when the problem is a missing GPS
 * fix sends them to the wrong place.
 */

const projectRoot = join(import.meta.dirname, "..");

function readProjectFile(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

test("the manifest declares the location permissions", () => {
  const manifest = readProjectFile("android/app/src/main/AndroidManifest.xml");

  // A permission that is not declared can never be granted, so the request
  // is dropped and the app never asks at all.
  expect(manifest).toContain("android.permission.ACCESS_FINE_LOCATION");
  expect(manifest).toContain("android.permission.ACCESS_COARSE_LOCATION");
});

test("a refusal and a missing fix are told apart", () => {
  const source = readProjectFile("src/lib/useLocationPermission.ts");

  // Only PERMISSION_DENIED is a refusal.
  expect(source).toContain("PERMISSION_DENIED");
  expect(source).toContain('"denied"');
  // A timeout or an unavailable position is a different thing entirely.
  expect(source).toContain('"unavailable"');
  expect(source).toContain("TIMEOUT");
});

test("the permission is asked for when the account is created, for both roles", () => {
  const page = readProjectFile("src/app/signup/page.tsx");

  // The step is on the screen, and the request goes up with it.
  expect(page).toContain('"location"');
  expect(page).toContain("location.request()");
  // The step is not a gate — the user can leave it.
  expect(page).toContain("Not now");
});

test("the signup page asks for the location for an operator as well as a passenger", () => {
  const page = readProjectFile("src/app/signup/page.tsx");

  // The step comes after the account is created, whichever role it is.
  expect(page).toContain('setStep("location")');
  // And the wording is different for the two, because the two are told
  // different things about what their location is used for.
  expect(page).toContain("isOperator");
});

test("the passenger is told when their driver cannot see them", () => {
  const page = readProjectFile("src/app/map/page.tsx");
  const step = readProjectFile("src/app/map/LocationStep.tsx");

  expect(page).toContain("locationNotice");
  expect(step).toContain("locationNotice");
  expect(step).toContain("onRequestLocation");
});

test("the driver is told when their position is not being shared", () => {
  const page = readProjectFile("src/app/operator/map/page.tsx");
  const header = readProjectFile("src/app/operator/OperatorHeader.tsx");

  expect(page).toContain("locationError");
  expect(header).toContain("Your passenger cannot see you");
});

test("the refusal message points at the right settings", () => {
  const source = readProjectFile("src/lib/geolocation.ts");

  // On a phone the setting belongs to the app; in a browser, to the browser.
  expect(source).toContain("isNativePlatform");
  expect(source).toContain("device settings");
  expect(source).toContain("browser settings");
});
