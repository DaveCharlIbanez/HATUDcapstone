"use client";

import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";

/**
 * What the server said the trip will cost.
 *
 * The shape of the answer is the router's, and it carries a quote for the
 * ride type the Android builds that predate the single ride type ask for.
 * They read it for a card they are about to stop offering, so it has to be
 * there — and it is the same fare, because there is only one.
 */
export interface FareQuoteSummary {
  standard: { fare: number };
}

/**
 * The price of the trip, priced by the server.
 *
 * The fare is charged on the road distance the router measured — the same
 * measurement behind the route the map draws, so the price the passenger is
 * shown and the road they are shown cannot disagree.
 *
 * It is fetched imperatively, because measuring it needs a network call, and
 * it is only asked for once both places have been resolved: the default of
 * 0,0 is not a real point.
 */
export function useFareQuote({
  dropoff,
  pickup,
  sessionToken,
}: {
  dropoff: { lat: number; lng: number };
  pickup: { lat: number; lng: number };
  sessionToken: string | null;
}): FareQuoteSummary | undefined {
  const [fareQuote, setFareQuote] = useState<FareQuoteSummary | undefined>();
  const quoteFare = useAction(api.rides.quoteFare);

  // Coordinates are only known once both addresses have been resolved.
  const hasRoute =
    pickup.lat !== 0 &&
    pickup.lng !== 0 &&
    dropoff.lat !== 0 &&
    dropoff.lng !== 0;

  useEffect(() => {
    if (!(sessionToken && hasRoute)) {
      setFareQuote(undefined);
      return;
    }

    let cancelled = false;
    quoteFare({
      sessionToken,
      pickup: { latitude: pickup.lat, longitude: pickup.lng },
      dropoff: { latitude: dropoff.lat, longitude: dropoff.lng },
    })
      .then((quote) => {
        if (!cancelled) {
          setFareQuote(quote);
        }
      })
      .catch((error) => {
        console.error("Could not price the trip:", error);
        if (!cancelled) {
          setFareQuote(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    dropoff.lat,
    dropoff.lng,
    hasRoute,
    pickup.lat,
    pickup.lng,
    quoteFare,
    sessionToken,
  ]);

  return fareQuote;
}
