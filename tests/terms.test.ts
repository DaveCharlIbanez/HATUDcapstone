import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { isScrolledToEnd, SCROLL_END_TOLERANCE_PX } from "../src/lib/scroll";
import { TERMS, TERMS_VERSION } from "../src/lib/terms";

/**
 * The terms, and the gate that unlocks the tick box.
 *
 * The scroll rule used to be worth getting wrong in exactly one way: a
 * document that is shorter than the box it is shown in cannot be scrolled, so
 * a gate that only watched for a scroll event would leave the tick box locked
 * for good, and signing up would be impossible.
 */

const projectRoot = join(import.meta.dirname, "..");

/** The version format: a number, a dot, a number. */
const VERSION_PATTERN = /^\d+\.\d+$/;

function readProjectFile(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

test("the terms have fifteen sections, and the fifteenth is the liability", () => {
  expect(TERMS.sections).toHaveLength(15);
  expect(TERMS.sections.at(-1)?.heading).toBe("Limitation of Liability");
});

test("the liability section says HATUD is not liable or accountable", () => {
  const liability = TERMS.sections.at(-1);
  const text = liability?.paragraphs.join(" ") ?? "";

  expect(text).toContain("not liable");
  expect(text).toContain("not accountable");
  expect(text).toContain("outcome");
});

test("every section has a heading and something to read", () => {
  for (const section of TERMS.sections) {
    expect(section.heading.length).toBeGreaterThan(0);
    expect(section.paragraphs.length).toBeGreaterThan(0);
  }
});

test("the terms carry an introduction, an agreement and a tick box label", () => {
  expect(TERMS.introduction).toContain("HATUD");
  expect(TERMS.agreement).toContain("read, understood, and agreed");
  expect(TERMS.checklist).toContain("Terms and Conditions");
  expect(TERMS.title).toBe("Terms and Conditions");
});

test("the terms carry a version", () => {
  expect(TERMS_VERSION).toMatch(VERSION_PATTERN);
});

test("a document that fits has been read already", () => {
  // There is nothing to scroll, so the tick box opens straight away.
  expect(
    isScrolledToEnd({ clientHeight: 400, scrollHeight: 380, scrollTop: 0 })
  ).toBe(true);
});

test("the top of a long document has not been read", () => {
  expect(
    isScrolledToEnd({ clientHeight: 400, scrollHeight: 2000, scrollTop: 0 })
  ).toBe(false);
});

test("the bottom of a long document has been read", () => {
  expect(
    isScrolledToEnd({ clientHeight: 400, scrollHeight: 2000, scrollTop: 1600 })
  ).toBe(true);
});

test("a touch short of the end still counts as the end", () => {
  expect(
    isScrolledToEnd({
      clientHeight: 400,
      scrollHeight: 2000,
      scrollTop: 1600 - SCROLL_END_TOLERANCE_PX + 1,
    })
  ).toBe(true);
});

test("well short of the end does not", () => {
  expect(
    isScrolledToEnd({ clientHeight: 400, scrollHeight: 2000, scrollTop: 1400 })
  ).toBe(false);
});

test("the signup page opens the terms and cannot create an account without them", () => {
  const page = readProjectFile("src/app/signup/page.tsx");

  // The dialog is on the page...
  expect(page).toContain("TermsDialog");
  // ...the account is only created once the terms have been accepted...
  expect(page).toContain("handleTermsAccepted");
  expect(page).toContain("acceptedTerms: true");
  // ...and the version that was accepted is sent with it.
  expect(page).toContain("TERMS_VERSION");
});

test("the dialog is a card over the page, not a page of its own", () => {
  const dialog = readProjectFile("src/components/TermsDialog.tsx");

  expect(dialog).toContain('role="dialog"');
  expect(dialog).toContain('aria-modal="true"');
  // Sized: it does not fill the screen.
  expect(dialog).toContain("max-w-lg");
  expect(dialog).toContain("max-h-[85dvh]");
  // The document scrolls; the rest of the card does not.
  expect(dialog).toContain("overflow-y-auto");
});

test("the tick box is locked until the document has been read", () => {
  const dialog = readProjectFile("src/components/TermsDialog.tsx");

  expect(dialog).toContain("disabled={!hasReachedEnd}");
  expect(dialog).toContain("disabled={!canAgree}");
  expect(dialog).toContain("isScrolledToEnd");
});
