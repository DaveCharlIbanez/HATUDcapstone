const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";
const OSRM_TABLE_URL = "https://router.project-osrm.org/table/v1/driving";

/**
 * A place as returned by Nominatim. The API returns every field as a string.
 */
export interface PlaceSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  name: string;
  place_id: number;
  type: string;
}

/**
 * A GeoJSON line string, as returned by OSRM.
 */
export interface RouteGeometry {
  coordinates: [number, number][];
  type: "LineString";
}

/**
 * What the router said about a road.
 *
 * The router measures the road as it draws it, so the time it takes to drive
 * comes back with it. There is no extra request to make for an estimate.
 */
export interface RouteInfo {
  /** The length of the road, in metres. */
  distanceMeters: number;
  /** How long the road takes to drive, in seconds. */
  durationSeconds: number;
  /** When it was measured. */
  measuredAt: number;
}

interface OsrmResponse {
  routes?: {
    distance?: number;
    duration?: number;
    geometry: RouteGeometry;
  }[];
}

interface OsrmTableResponse {
  durations?: (number | null)[][];
}

export async function searchPlace(query: string): Promise<PlaceSuggestion[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}?format=json&q=${encodeURIComponent(query)}&limit=5`,
      { headers: { Accept: "application/json" } }
    );
    // Nominatim's search endpoint answers with a bare array of places. It
    // used to be read as an object with a `results` key, which is always
    // undefined — so the search returned nothing at all, and the only way to
    // set a pickup was to use the device's own position.
    const data = (await response.json()) as PlaceSuggestion[];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error searching place:", error);
    return [];
  }
}

/**
 * The road between two places, and how long it takes to drive.
 *
 * The router's duration is the time the road takes at its own speed profile.
 * The public server has no live traffic, so this is an estimate of the road,
 * not a promise about the traffic on it.
 */
export async function getRoute(
  start: [number, number],
  end: [number, number]
): Promise<(RouteInfo & { geometry: RouteGeometry }) | null> {
  try {
    const response = await fetch(
      `${OSRM_BASE_URL}/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`
    );
    const data = (await response.json()) as OsrmResponse;
    const first = data.routes?.[0];
    if (!first?.geometry) {
      return null;
    }
    return {
      distanceMeters: first.distance ?? 0,
      durationSeconds: first.duration ?? 0,
      geometry: first.geometry,
      measuredAt: Date.now(),
    };
  } catch (error) {
    console.error("Error getting route:", error);
    return null;
  }
}

/**
 * How long the road takes from one place to a number of others.
 *
 * The router's table service answers a whole matrix of journeys in one
 * request, which is what makes it affordable to put a time on every open
 * request in a driver's queue: one request for the queue, not one for each
 * request in it.
 *
 * The results are in the order the destinations were given.
 */
export async function getRouteDurations(
  origin: [number, number],
  destinations: [number, number][]
): Promise<number[]> {
  if (destinations.length === 0) {
    return [];
  }

  try {
    const points = [origin, ...destinations]
      .map(([longitude, latitude]) => `${longitude},${latitude}`)
      .join(";");

    const response = await fetch(
      `${OSRM_TABLE_URL}/${points}?annotations=duration`
    );
    const data = (await response.json()) as OsrmTableResponse;
    const row = data.durations?.[0];
    if (!row) {
      return [];
    }

    // The first column is the origin itself, which is a zero.
    return row.slice(1).map((seconds) => seconds ?? 0);
  } catch (error) {
    console.error("Error getting route durations:", error);
    return [];
  }
}
