export async function searchPlace(query: string): Promise<any[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error searching place:", error);
    return [];
  }
}

export async function getRoute(
  start: [number, number],
  end: [number, number]
): Promise<any> {
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`
    );
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].geometry;
    }
    return null;
  } catch (error) {
    console.error("Error getting route:", error);
    return null;
  }
}
