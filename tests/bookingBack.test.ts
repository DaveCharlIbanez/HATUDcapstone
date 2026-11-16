import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/**
 * The way back out of the booking sheet.
 *
 * The sheet is a sequence of steps — the locations, the vehicle, the payment
 * method — and until the ride is created every one of them can be left.
 * There was no way to do that: the sheet could only be dismissed, and
 * dismissing threw the whole booking away and put the rider back on the
 * map. Going back is not that.
 */

const projectRoot = join(import.meta.dirname, "..");

function readProjectFile(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

test("the booking sheet offers a dedicated back button", () => {
  const page = readProjectFile("src/app/map/page.tsx");

  expect(page).toContain("BookingBack");
  // It is rendered only when there is somewhere to go back to.
  expect(page).toContain("backTargetFor(step)");
  expect(page).toContain("backTarget &&");
});

test("the back button is a real button that names where it goes", () => {
  const back = readProjectFile("src/app/map/BookingBack.tsx");

  expect(back).toContain("<button");
  expect(back).toContain('type="button"');
  // It says where the rider will land, rather than just "back".
  expect(back).toContain("{label}");
  expect(back).toContain("FaArrowLeft");
});

test("going back is not a reset", () => {
  const page = readProjectFile("src/app/map/page.tsx");

  const handler = page.slice(
    page.indexOf("const handleGoBack"),
    page.indexOf("const handleGoBack") + 900
  );

  // It moves to the previous step and changes nothing else. The pickup, the
  // destination, the vehicle and the payment method are all still there when
  // the rider comes forward again.
  expect(handler).toContain("setStep(target)");
  expect(handler).not.toContain("resetBooking");
  expect(handler).not.toContain("setPickup(");
  expect(handler).not.toContain("setSelectedVehicle(");
  expect(handler).not.toContain("setPaymentMethod(");
});

test("a step cannot be left while the ride is being created", () => {
  const page = readProjectFile("src/app/map/page.tsx");

  const handler = page.slice(
    page.indexOf("const handleGoBack"),
    page.indexOf("const handleGoBack") + 900
  );

  // The request is already on its way; leaving the step now would leave the
  // rider looking at a booking they did not make.
  expect(handler).toContain("if (isBooking)");
  expect(page).toContain("disabled={isBooking}");
});

test("dismissing the sheet is still a reset, and is not the back button", () => {
  const page = readProjectFile("src/app/map/page.tsx");

  // Two different things, and they must not be confused. Dragging the sheet
  // away throws the booking out; the back button steps back through it.
  const dismiss = page.slice(
    page.indexOf("const handleDismissSheet"),
    page.indexOf("const handleDismissSheet") + 400
  );

  expect(dismiss).toContain("resetBooking()");
  expect(dismiss).not.toContain("setStep(");
});
