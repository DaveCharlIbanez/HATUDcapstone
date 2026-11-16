import { expect, test, vi } from "vitest";
import { searchPlace } from "../src/lib/mapClient";

/**
 * Finding a place by name.
 *
 * The geocoder answers with a bare list of places. It used to be read as an
 * object with a `results` key, which is always undefined — so the search
 * returned nothing at all, and the only way to set a pickup was to use the
 * device's own position.
 */

const PLACE = {
  display_name: "Robinsons Supermarket, Antique, Philippines",
  lat: "10.7357",
  lon: "121.9515",
  name: "Robinsons Supermarket",
  place_id: 260_561_021,
  type: "shop",
};

async function withFetch(
  body: unknown,
  run: () => Promise<void>
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(async () => ({
    json: async () => body,
  })) as unknown as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("the geocoder's answer is a list of places", async () => {
  await withFetch([PLACE], async () => {
    const results = await searchPlace("Robinsons Supermarket");

    expect(results).toHaveLength(1);
    expect(results[0]?.display_name).toBe(PLACE.display_name);
    expect(results[0]?.lat).toBe("10.7357");
  });
});

test("an answer that is not a list is treated as no answers", async () => {
  await withFetch({ error: "nope" }, async () => {
    expect(await searchPlace("Robinsons Supermarket")).toEqual([]);
  });
});

test("an empty search asks the geocoder for nothing", async () => {
  const original = globalThis.fetch;
  const spy = vi.fn();
  globalThis.fetch = spy as unknown as typeof fetch;
  try {
    expect(await searchPlace("   ")).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  } finally {
    globalThis.fetch = original;
  }
});
