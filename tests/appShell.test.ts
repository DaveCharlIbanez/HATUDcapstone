import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { HELP } from "../src/lib/help";

/**
 * The app shell, the drawer and the new pages.
 *
 * The shell is the app's one navigation model, so the things it promises have
 * to be there: the drawer, the landing page, the settings, the help, and the
 * fact that the public pages never carry the drawer.
 */

const projectRoot = join(import.meta.dirname, "..");

/** The base fare the app charges. */
const BASE_FARE = /standard:\s*\{\s*base:\s*(\d+)/;

/** The rate per started kilometre. */
const RATE_PER_KM = /standard:\s*\{[^}]*perKm:\s*(\d+)/;

function readProjectFile(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

test("a signed-in user lands on the dashboard, whatever their role", () => {
  const roles = readProjectFile("src/lib/roles.ts");

  expect(roles).toContain('commuter: "/dashboard"');
  expect(roles).toContain('operator: "/dashboard"');
  expect(roles).toContain('admin: "/dashboard"');
});

test("the drawer is never rendered on the public pages", () => {
  const shell = readProjectFile("src/components/AppShell.tsx");

  expect(shell).toContain('"/", "/login", "/signup"');
  expect(shell).toContain("isPublic");
  // The drawer only appears for somebody who is signed in.
  expect(shell).toContain("Boolean(user)");
});

test("the header sits inside the shell that owns the drawer", () => {
  const layout = readProjectFile("src/app/layout.tsx");

  // The header carries the menu button, so it has to be inside the shell's
  // context. Outside it, every page that shows the header throws.
  const shellAt = layout.indexOf("<AppShell>");
  const headerAt = layout.indexOf("<HeaderClient />");

  expect(shellAt).toBeGreaterThan(-1);
  expect(headerAt).toBeGreaterThan(shellAt);
});

test("the drawer slides in and out rather than appearing", () => {
  const drawer = readProjectFile("src/components/AppDrawer.tsx");

  // It stays mounted and moves, so the collapse is animated in both
  // directions.
  expect(drawer).toContain("translate-x-0");
  expect(drawer).toContain("-translate-x-full");
  expect(drawer).toContain("transition-transform");
  expect(drawer).toContain("duration-300");
  // And it is inert while it is closed, so nothing behind it can be focused.
  expect(drawer).toContain("inert={!isOpen}");
});

test("going to a page plays a short HATUD loading beat", () => {
  const shell = readProjectFile("src/components/AppShell.tsx");

  expect(shell).toContain("NAVIGATION_BEAT_MS");
  expect(shell).toContain("navigate");
  expect(shell).toContain("AppLoader");
  // The beat ends when the screen has actually changed.
  expect(shell).toContain("pathname === navigatingTo");
});

test("the drawer carries the navigation the app promises", () => {
  const drawer = readProjectFile("src/components/AppDrawer.tsx");

  for (const entry of [
    "Dashboard",
    "Book a ride",
    "See available rides",
    "My profile",
    "Settings",
    "Help",
  ]) {
    expect(drawer).toContain(entry);
  }
});

test("the drawer opens with the dashboard, not a bare wordmark", () => {
  const drawer = readProjectFile("src/components/AppDrawer.tsx");

  // The wordmark carries the user's own numbers.
  expect(drawer).toContain("HATUD");
  expect(drawer).toContain("commuterSummary");
  expect(drawer).toContain("operatorSummary");
  expect(drawer).toContain("adminSummary");
  // And the quick action the brief asked for.
  expect(drawer).toContain("ThemeToggle");
});

test("the burger never overlaps the chrome on the map screens", () => {
  const commuter = readProjectFile("src/app/map/MapOverlays.tsx");
  const operator = readProjectFile("src/app/operator/OperatorHeader.tsx");

  // The desktop card and the header both start clear of the floating button.
  expect(commuter).toContain("left-[4.5rem]");
  expect(operator).toContain("md:pl-[4.5rem]");
});

test("the settings page reads the real permission state", () => {
  const settings = readProjectFile("src/app/settings/page.tsx");

  expect(settings).toContain("navigator.permissions.query");
  expect(settings).toContain("Notification.permission");
  expect(settings).toContain("Notification.requestPermission");
  expect(settings).toContain("getCurrentPosition");
  // A browser that cannot report a permission says so, rather than lying.
  expect(settings).toContain('"unknown"');
});

test("the help page covers every section the drawer promises", () => {
  const sections = HELP.sections.map((section) => section.heading);

  expect(sections).toContain("Getting started");
  expect(sections).toContain("On the map");
  expect(sections).toContain("Your account");
  expect(sections).toContain("Payments");
  expect(sections).toContain("For drivers");
});

test("the FAQs answer the questions people actually ask", () => {
  expect(HELP.faqs.length).toBeGreaterThanOrEqual(8);

  const questions = HELP.faqs.map((faq) => faq.question);
  expect(questions).toContain("How do I book a ride?");
  expect(questions).toContain("How is the fare worked out?");
  expect(questions).toContain("Where do I change my password?");
  expect(questions).toContain("How do I turn location on?");

  for (const faq of HELP.faqs) {
    expect(faq.answer.length).toBeGreaterThan(20);
  }
});

test("the help describes the fare the app actually charges", () => {
  const fares = readProjectFile("convex/lib/fare.ts");
  const standard = BASE_FARE.exec(fares);
  const perKm = RATE_PER_KM.exec(fares);

  expect(standard?.[1]).toBe("30");
  expect(perKm?.[1]).toBe("12");

  // The help must not quote a different number.
  const help = JSON.stringify(HELP);
  expect(help).toContain("thirty pesos");
  expect(help).toContain("twelve pesos");
});

test("the change password form lives in settings, which both profiles link to", () => {
  const settings = readProjectFile("src/app/settings/page.tsx");
  const commuter = readProjectFile("src/app/profile/page.tsx");
  const operator = readProjectFile("src/app/operator/profile/page.tsx");

  expect(settings).toContain("ChangePasswordCard");
  expect(commuter).toContain('href="/settings"');
  expect(operator).toContain('href="/settings"');
});

test("settings and both profiles are drop-downs, not long lists", () => {
  for (const path of [
    "src/app/settings/page.tsx",
    "src/app/profile/page.tsx",
    "src/app/operator/profile/page.tsx",
  ]) {
    const source = readProjectFile(path);
    expect(source).toContain("<SettingsGroup>");
    expect(source).toContain("<SettingsSection");
  }
});
