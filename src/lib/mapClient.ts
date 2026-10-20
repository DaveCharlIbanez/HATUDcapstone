const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

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

interface NominatimResponse {
  results?: PlaceSuggestion[];
}

interface OsrmResponse {
  routes?: { geometry: RouteGeometry }[];
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
    const data = (await response.json()) as NominatimResponse;
    return data.results ?? [];
  } catch (error) {
    console.error("Error searching place:", error);
    return [];
  }
}

export async function getRoute(
  start: [number, number],
  end: [number, number]
): Promise<RouteGeometry | null> {
  try {
    const response = await fetch(
      `${OSRM_BASE_URL}/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`
    );
    const data = (await response.json()) as OsrmResponse;
    const first = data.routes?.[0];
    return first?.geometry ?? null;
  } catch (error) {
    console.error("Error getting route:", error);
    return null;
  }
}
