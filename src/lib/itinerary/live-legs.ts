/**
 * Which legs of a day are worth asking Google Maps about (pure, unit-tested):
 * consecutive stops with real coordinates, more than a few steps apart, inside the same area.
 * Journeys between cities and verified fixed legs (e.g. the Malpensa Express) are left as they are.
 */
import { haversineMeters, type TravelMode } from "@/lib/geo";
import type { StopDetails } from "./types";

export interface LegStop {
  id: string;
  lat: number | null;
  lng: number | null;
  travelMode: TravelMode | null;
  travelMeters: number | null;
  details?: StopDetails | null;
}

export interface LegToCheck {
  stopId: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  mode: TravelMode;
}

export function legsToCheck(stops: LegStop[], max = 14): LegToCheck[] {
  const out: LegToCheck[] = [];
  for (let i = 0; i < stops.length - 1 && out.length < max; i++) {
    const s = stops[i];
    const n = stops[i + 1];
    if (s.lat == null || s.lng == null || n.lat == null || n.lng == null || !s.travelMode) continue;
    if (s.details?.fixedLeg || s.details?.intercity) continue;
    if (n.details?.intercity && !n.details.intercity.fromStation) continue;
    const d = haversineMeters({ lat: s.lat, lng: s.lng }, { lat: n.lat, lng: n.lng });
    if (d < 60 || d > 60_000) continue;
    out.push({ stopId: s.id, from: { lat: s.lat, lng: s.lng }, to: { lat: n.lat, lng: n.lng }, mode: s.travelMode });
  }
  return out;
}
