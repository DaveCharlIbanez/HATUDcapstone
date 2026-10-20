export type LandmarkCategory =
  | "government"
  | "school"
  | "church"
  | "market"
  | "hospital"
  | "park"
  | "terminal"
  | "restaurant"
  | "cafe"
  | "mall";

export type Municipality = "sanJose" | "sibalom";

export interface Landmark {
  id: string;
  name: string;
  address: string;
  category: LandmarkCategory;
  municipality: Municipality;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export const CATEGORY_INFO: Record<
  LandmarkCategory,
  { icon: string; color: string }
> = {
  government: { icon: "🏛️", color: "#8B5CF6" },
  school: { icon: "🎓", color: "#3B82F6" },
  church: { icon: "⛪", color: "#F97316" },
  market: { icon: "🏪", color: "#EAB308" },
  hospital: { icon: "🏥", color: "#EF4444" },
  park: { icon: "🌳", color: "#22C55E" },
  terminal: { icon: "🚌", color: "#92400E" },
  restaurant: { icon: "🍽️", color: "#EC4899" },
  cafe: { icon: "☕", color: "#F472B6" },
  mall: { icon: "🛒", color: "#14B8A6" },
};

export const MUNICIPALITY_LABELS: Record<Municipality, string> = {
  sanJose: "San Jose",
  sibalom: "Sibalom",
};

export const landmarks: Landmark[] = [
  {
    id: "sj-municipal-hall",
    name: "San Jose de Buenavista Municipal Hall",
    address: "Representative Salazar Street, Madrangca, Poblacion, Maybato North, San Jose de Buenavista, Antique",
    category: "government",
    municipality: "sanJose",
    coordinates: { lat: 10.7468, lng: 121.9414 },
  },
  {
    id: "sj-peters-paul-church",
    name: "Saints Peter and Paul Parish Church",
    address: "Sang Dios Street, San Pedro, San Jose de Buenavista, Antique",
    category: "church",
    municipality: "sanJose",
    coordinates: { lat: 10.7992, lng: 121.949 },
  },
  {
    id: "sj-st-peter-church",
    name: "St. Peter Church",
    address: "Real Street, Madrangca, Poblacion, San Fernando, San Jose de Buenavista, Antique",
    category: "church",
    municipality: "sanJose",
    coordinates: { lat: 10.8005, lng: 121.9478 },
  },
  {
    id: "sj-antique-national-school",
    name: "Antique National School",
    address: "Tobias A. Fornier Street, Atabay, Poblacion, Badiang, San Jose de Buenavista, Antique",
    category: "school",
    municipality: "sanJose",
    coordinates: { lat: 10.7525, lng: 121.9424 },
  },
  {
    id: "sj-san-pedro-high-school",
    name: "San Pedro National High School",
    address: "Real Street, San Pedro, San Jose de Buenavista, Antique",
    category: "school",
    municipality: "sanJose",
    coordinates: { lat: 10.8059, lng: 121.9513 },
  },
  {
    id: "sj-capadocia-memorial-school",
    name: "Governor Santos Capadocia Memorial School",
    address: "Gobierno Street, Bugante Point, Malaiba, Poblacion, Maybato North, San Jose de Buenavista, Antique",
    category: "school",
    municipality: "sanJose",
    coordinates: { lat: 10.7406, lng: 121.9377 },
  },
  {
    id: "sj-angel-salazar-hospital",
    name: "Angel Salazar Memorial General Hospital",
    address: "Tobias A. Fornier Street, Atabay, Poblacion, Badiang, San Jose de Buenavista, Antique",
    category: "hospital",
    municipality: "sanJose",
    coordinates: { lat: 10.7535, lng: 121.9424 },
  },
  {
    id: "sj-north-south-terminal",
    name: "San Jose New North and South Terminal",
    address: "Angel Abiera Salazar Street, Atabay, Poblacion, Badiang, San Jose de Buenavista, Antique",
    category: "terminal",
    municipality: "sanJose",
    coordinates: { lat: 10.7549, lng: 121.9346 },
  },
  {
    id: "sj-tricycle-terminal",
    name: "Tricycle Terminal",
    address: "Villavert Jimenez Street, Malaiba, Poblacion, Maybato North, San Jose de Buenavista, Antique",
    category: "terminal",
    municipality: "sanJose",
    coordinates: { lat: 10.7451, lng: 121.943 },
  },
  {
    id: "sj-business-park",
    name: "San Jose de Buenavista Business Park",
    address: "Malaiba, Poblacion, Maybato North, San Jose de Buenavista, Antique",
    category: "mall",
    municipality: "sanJose",
    coordinates: { lat: 10.7457, lng: 121.9423 },
  },
  {
    id: "sj-citymall",
    name: "CityMall Antique",
    address: "San Jose Street, Bugante Point, Malaiba, Poblacion, Maybato North, San Jose de Buenavista, Antique",
    category: "mall",
    municipality: "sanJose",
    coordinates: { lat: 10.7425, lng: 121.9408 },
  },
  {
    id: "sj-gaisano",
    name: "Gaisano Grand Antique",
    address: "Governor Fullon Street, Aguilon Subdivision, San Angel, Poblacion, Maybato North, San Jose de Buenavista, Antique",
    category: "mall",
    municipality: "sanJose",
    coordinates: { lat: 10.7432, lng: 121.9484 },
  },
  {
    id: "sj-freedom-park",
    name: "Evelio B. Javier Freedom Park",
    address: "Malaiba, Poblacion, Maybato North, San Jose de Buenavista, Antique",
    category: "park",
    municipality: "sanJose",
    coordinates: { lat: 10.744, lng: 121.9412 },
  },
  {
    id: "sj-robinsons",
    name: "Robinsons Supermarket",
    address: "Iloilo-Antique Road, Aguilon Subdivision, San Angel, Poblacion, Maybato Sur, San Jose de Buenavista, Antique",
    category: "mall",
    municipality: "sanJose",
    coordinates: { lat: 10.7357, lng: 121.9515 },
  },
  {
    id: "sj-regina-restaurant",
    name: "Regina's Restaurant",
    address: "Capadocia Street, Bugante Point, Madrangca, Poblacion, Maybato North, San Jose de Buenavista, Antique",
    category: "restaurant",
    municipality: "sanJose",
    coordinates: { lat: 10.744, lng: 121.9401 },
  },
  {
    id: "sj-max-restaurant",
    name: "Max's Restaurant",
    address: "Iloilo-Antique Road, Aguilon Subdivision, San Angel, Poblacion, Maybato North, San Jose de Buenavista, Antique",
    category: "restaurant",
    municipality: "sanJose",
    coordinates: { lat: 10.7363, lng: 121.9516 },
  },
  {
    id: "sj-moscoso-restaurant",
    name: "moscoso restaurant",
    address: "Real Street, Madrangca, Poblacion, San Fernando, San Jose de Buenavista, Antique",
    category: "restaurant",
    municipality: "sanJose",
    coordinates: { lat: 10.7995, lng: 121.9483 },
  },
  {
    id: "sj-plaza-cafe",
    name: "The Plaza Cafe",
    address: "Ricarze Street, Bugante Point, Malaiba, Poblacion, Maybato North, San Jose de Buenavista, Antique",
    category: "cafe",
    municipality: "sanJose",
    coordinates: { lat: 10.7436, lng: 121.9404 },
  },
  {
    id: "sj-le-arte-cafe",
    name: "Le Arte Cafe",
    address: "Bantayan Road, San Pedro, San Jose de Buenavista, Antique",
    category: "cafe",
    municipality: "sanJose",
    coordinates: { lat: 10.7929, lng: 121.9607 },
  },
  {
    id: "sb-santa-rita-church",
    name: "Santa Rita Parish Church",
    address: "Fenete Street, District Ⅱ, Solong, Sibalom, Antique",
    category: "church",
    municipality: "sibalom",
    coordinates: { lat: 10.7891, lng: 122.0185 },
  },
  {
    id: "sb-evangelical-church",
    name: "Sibalom Evangelical Church",
    address: "Veñegas Street, District Ⅱ, Solong, Sibalom, Antique",
    category: "church",
    municipality: "sibalom",
    coordinates: { lat: 10.7894, lng: 122.0166 },
  },
  {
    id: "sb-egana-elementary",
    name: "Egaña Elementary School",
    address: "Hamtic - Bia-an - Egaña - Sibalom Road, Lotilla, Tigbalua Ⅱ, Catungan Ⅰ, Sibalom, Antique",
    category: "school",
    municipality: "sibalom",
    coordinates: { lat: 10.7483, lng: 122.0081 },
  },
  {
    id: "sb-egana-high-school",
    name: "Egaña National High School",
    address: "Hamtic - Bia-an - Egaña - Sibalom Road, Lotilla, Tigbalua Ⅱ, Catungan Ⅰ, Sibalom, Antique",
    category: "school",
    municipality: "sibalom",
    coordinates: { lat: 10.749, lng: 122.0073 },
  },
  {
    id: "sb-ramon-maza-hospital",
    name: "Ramon Maza, Sr. Memorial District Hospital",
    address: "Hamtic - Bia-an - Egaña - Sibalom Road, Lotilla, Catungan Ⅰ, Sibalom, Antique",
    category: "hospital",
    municipality: "sibalom",
    coordinates: { lat: 10.7775, lng: 122.0198 },
  },
  {
    id: "sb-public-market",
    name: "Sibalom Public Market",
    address: "Tordesillas Street, District Ⅱ, Solong, Sibalom, Antique",
    category: "market",
    municipality: "sibalom",
    coordinates: { lat: 10.7866, lng: 122.0184 },
  },
];

export const getLandmarksByMunicipality = (
  municipality: Municipality | "all"
): Landmark[] => {
  if (municipality === "all") {
    return landmarks;
  }
  return landmarks.filter((l) => l.municipality === municipality);
};

export const getLandmarksByCategory = (
  category: LandmarkCategory
): Landmark[] => {
  return landmarks.filter((l) => l.category === category);
};

export const getCategoryLabel = (category: LandmarkCategory): string => {
  const labels: Record<LandmarkCategory, string> = {
    government: "Government",
    school: "School",
    church: "Church",
    market: "Market",
    hospital: "Hospital",
    park: "Park",
    terminal: "Terminal",
    restaurant: "Restaurant",
    cafe: "Cafe",
    mall: "Mall / Commercial",
  };
  return labels[category];
};
