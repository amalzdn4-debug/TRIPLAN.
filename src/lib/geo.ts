export interface LatLng {
  lat: number;
  lng: number;
}

export type TravelMode = "walking" | "transit" | "driving" | "cycling";
export type TransportPreference = "walking" | "public" | "driving" | "cycling" | "mixed";

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Street networks are longer than straight lines; 1.3 is a common urban detour factor. */
const DETOUR = 1.3;
const SPEED_KMH: Record<TravelMode, number> = { walking: 4.8, cycling: 14, transit: 18, driving: 24 };
const OVERHEAD_MIN: Record<TravelMode, number> = { walking: 0, cycling: 3, transit: 8, driving: 6 };

/** Picks a sensible mode for a leg given the traveller's preference and the distance. */
export function chooseMode(pref: TransportPreference, straightMeters: number): TravelMode {
  const d = straightMeters * DETOUR;
  switch (pref) {
    case "walking":
      return d <= 2500 ? "walking" : "transit";
    case "cycling":
      return d <= 800 ? "walking" : d <= 12000 ? "cycling" : "transit";
    case "driving":
      return d <= 700 ? "walking" : "driving";
    case "public":
    case "mixed":
    default:
      return d <= 1200 ? "walking" : "transit";
  }
}

/** Approximate leg: always labelled as an estimate in the UI. */
export function estimateLeg(a: LatLng, b: LatLng, mode: TravelMode): { minutes: number; meters: number } {
  const straight = haversineMeters(a, b);
  const meters = Math.round(straight * DETOUR);
  if (meters < 40) return { minutes: 0, meters };
  const minutes = Math.round((meters / 1000 / SPEED_KMH[mode]) * 60 + OVERHEAD_MIN[mode]);
  return { minutes: Math.max(minutes, 2), meters };
}

export function centroid(points: LatLng[]): LatLng | null {
  if (!points.length) return null;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
  };
}

export const GOOGLE_TRAVEL_MODE: Record<TravelMode, string> = {
  walking: "walking",
  transit: "transit",
  driving: "driving",
  cycling: "bicycling",
};

/** External navigation hand-off (no API key required). */
export function googleMapsDirectionsUrl(points: LatLng[], mode: TravelMode = "walking"): string | null {
  if (points.length < 2) return null;
  const fmt = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  const params = new URLSearchParams({
    api: "1",
    origin: fmt(points[0]),
    destination: fmt(points[points.length - 1]),
    travelmode: GOOGLE_TRAVEL_MODE[mode],
  });
  const way = points.slice(1, -1).slice(0, 9); // Google URLs accept up to 9 waypoints
  if (way.length) params.set("waypoints", way.map(fmt).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function googleMapsPlaceUrl(name: string, city?: string | null): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(city ? `${name}, ${city}` : name)}`;
}
