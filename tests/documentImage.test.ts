import { expect, test } from "vitest";
import {
  ALLOWED_MIME_TYPES,
  MAX_EDGE,
  MAX_RAW_BYTES,
  scaledDimensions,
  validateDocumentFile,
} from "../src/lib/documentImage";

test("only PNG and JPG are accepted", () => {
  expect(ALLOWED_MIME_TYPES).toEqual(["image/png", "image/jpeg"]);

  expect(validateDocumentFile({ size: 1024, type: "image/png" })).toEqual({
    ok: true,
  });
  expect(validateDocumentFile({ size: 1024, type: "image/jpeg" })).toEqual({
    ok: true,
  });
});

test("anything else is refused with a reason", () => {
  const pdf = validateDocumentFile({ size: 1024, type: "application/pdf" });
  expect(pdf.ok).toBe(false);
  if (!pdf.ok) {
    expect(pdf.error).toContain("PNG and JPG");
  }

  const gif = validateDocumentFile({ size: 1024, type: "image/gif" });
  expect(gif.ok).toBe(false);

  const heic = validateDocumentFile({ size: 1024, type: "image/heic" });
  expect(heic.ok).toBe(false);
});

test("an empty file is refused", () => {
  const empty = validateDocumentFile({ size: 0, type: "image/png" });
  expect(empty.ok).toBe(false);
  if (!empty.ok) {
    expect(empty.error).toContain("empty");
  }
});

test("a file over the raw cap is refused", () => {
  const tooBig = validateDocumentFile({
    size: MAX_RAW_BYTES + 1,
    type: "image/jpeg",
  });
  expect(tooBig.ok).toBe(false);
  if (!tooBig.ok) {
    expect(tooBig.error).toContain("too large");
  }

  expect(
    validateDocumentFile({ size: MAX_RAW_BYTES, type: "image/jpeg" }).ok
  ).toBe(true);
});

test("an image inside the cap is left alone", () => {
  expect(scaledDimensions(800, 600)).toEqual({ height: 600, width: 800 });
  expect(scaledDimensions(1600, 1200)).toEqual({ height: 1200, width: 1600 });
});

test("a large image is scaled to the longest edge", () => {
  expect(scaledDimensions(4000, 3000)).toEqual({ height: 1200, width: 1600 });
  expect(scaledDimensions(3000, 4000)).toEqual({ height: 1600, width: 1200 });
});

test("a very thin image never collapses to nothing", () => {
  expect(scaledDimensions(4000, 12)).toEqual({ height: 5, width: 1600 });
  expect(scaledDimensions(12, 4000)).toEqual({ height: 1600, width: 5 });
});

test("the scale cap is the documented one", () => {
  expect(MAX_EDGE).toBe(1600);
  expect(scaledDimensions(3200, 2400)).toEqual({ height: 1200, width: 1600 });
});
