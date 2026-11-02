/**
 * Nearby destinations and how to get there. Pure functions (unit-tested), shared by destination pages
 * and the trip planner.
 *
 *  • Curated connections (src/data/connections.ts, editable in admin) give typical journey times.
 *  • Otherwise a road estimate from straight-line distance is used — clearly labelled as an estimate —
 *    and never across water (islands need a curated ferry or flight).
 *  • Flights carry ~2 h of airport time, so a 45-minute flight is not treated like a 45-minute train.
 */
import { haversineMeters } from "@/lib/geo";

export type ConnectionMode = "train" | "bus" | "ferry" | "flight" | "car";
export type Suitability = "day_trip" | "short_stay" | "multi_day";

export interface NearbyCandidate {
  slug: string;
  city: string;
  countryCode: string;
  lat: number;
  lng: number;
  kind: "city" | "coastal" | "island" | "nature";
  daysMin: number;
  daysMax: number;
  popularity: number;
  styles?: string[];
  experiences?: string[];
}

export interface ConnectionRow {
  from: string;
  to: string;
  mode: ConnectionMode;
  minutes: number;
  direct: boolean;
  note?: string | null;
  verified?: boolean;
}

export interface Leg {
  mode: ConnectionMode;
  minutes: number;
  /** Door-to-door estimate used for planning (adds airport/station time). */
  effectiveMinutes: number;
  direct: boolean;
  source: "curated" | "estimate";
  note?: string | null;
  distanceKm: number;
}

export interface NearbyOption extends NearbyCandidate {
  leg: Leg;
  suitability: Suitability;
  score: number;
}

const ROAD_DETOUR = 1.3;
const ROAD_KMH = 65;
/** Extra time on top of the in-vehicle time, by mode. */
export const OVERHEAD_MIN: Record<ConnectionMode, number> = { train: 20, bus: 20, ferry: 40, flight: 120, car: 10 };

export function estimateRoadLeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): Leg {
  const km = haversineMeters(a, b) / 1000;
  const minutes = Math.round(((km * ROAD_DETOUR) / ROAD_KMH) * 60 + 10);
  return { mode: "car", minutes, effectiveMinutes: minutes + OVERHEAD_MIN.car, direct: true, source: "estimate", distanceKm: Math.round(km) };
}

/** The most practical curated connection: ground transport wins unless a flight is clearly faster door to door. */
export function bestCuratedLeg(rows: ConnectionRow[], distanceKm: number): Leg | null {
  if (!rows.length) return null;
  const legs = rows.map<Leg>((r) => ({ mode: r.mode, minutes: r.minutes, effectiveMinutes: r.minutes + OVERHEAD_MIN[r.mode], direct: r.direct, source: "curated", note: r.note ?? null, distanceKm }));
  legs.sort((x, y) => x.effectiveMinutes - y.effectiveMinutes || Number(x.mode === "flight") - Number(y.mode === "flight"));
  return legs[0];
}

export function suitabilityFor(leg: Leg): Suitability {
  if (leg.effectiveMinutes <= 120) return "day_trip";
  if (leg.effectiveMinutes <= 240) return "short_stay";
  return "multi_day";
}

export function connectionsBetween(all: ConnectionRow[], a: string, b: string): ConnectionRow[] {
  return all.filter((c) => (c.from === a && c.to === b) || (c.from === b && c.to === a));
}

export function legBetween(
  a: NearbyCandidate | { slug: string; lat: number; lng: number; kind: string },
  b: NearbyCandidate | { slug: string; lat: number; lng: number; kind: string },
  connections: ConnectionRow[],
): Leg | null {
  const km = Math.round(haversineMeters(a, b) / 1000);
  const curated = bestCuratedLeg(connectionsBetween(connections, a.slug, b.slug), km);
  if (curated) return curated;
  if (a.kind === "island" || b.kind === "island") return null; // no road across water
  if (km > 450) return null;
  return estimateRoadLeg(a, b);
}

/** Destinations reachable from `origin` within `maxEffectiveMinutes`, best first. */
export function nearbyDestinations(
  origin: { slug: string; lat: number; lng: number; kind: string },
  candidates: NearbyCandidate[],
  connections: ConnectionRow[],
  { maxEffectiveMinutes = 330, limit = 8 }: { maxEffectiveMinutes?: number; limit?: number } = {},
): NearbyOption[] {
  const out: NearbyOption[] = [];
  for (const c of candidates) {
    if (c.slug === origin.slug) continue;
    const leg = legBetween(origin, c, connections);
    if (!leg || leg.effectiveMinutes > maxEffectiveMinutes) continue;
    // Popular places with short, direct journeys rank highest; curated links are preferred over estimates.
    const score = c.popularity - leg.effectiveMinutes / 6 + (leg.source === "curated" ? 8 : 0) + (leg.direct ? 4 : 0);
    out.push({ ...c, leg, suitability: suitabilityFor(leg), score });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, limit);
}
