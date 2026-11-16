import { afterEach, beforeEach, vi } from "vitest";

/**
 * The router is never reached in the tests.
 *
 * Booking and quoting are actions that ask OSRM for the road distance. The
 * tests stub the router, so nothing touches the network and the distance
 * that gets measured is the one the test chose.
 */

interface RouterState {
  /** The distance the router reports, in kilometres. */
  distanceKm: number;
  /** When set, the router refuses to answer. */
  fails: boolean;
}

const state: RouterState = { distanceKm: 5, fails: false };

/** The distance the stubbed router reports. */
export function setRouterDistance(distanceKm: number): void {
  state.distanceKm = distanceKm;
  state.fails = false;
}

/** The stubbed router refuses to answer, as a router that is down would. */
export function failRouter(): void {
  state.fails = true;
}

beforeEach(() => {
  state.distanceKm = 5;
  state.fails = false;

  // The sandbox mailbox is on in the tests, so a sign-up code can be read
  // back. A live deployment never holds a readable code.
  process.env.SIGNUP_SANDBOX = "1";

  vi.stubGlobal("fetch", () => {
    if (state.fails) {
      return Promise.reject(new Error("The router is unreachable"));
    }
    return Promise.resolve(
      Response.json({ routes: [{ distance: state.distanceKm * 1000 }] })
    );
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
