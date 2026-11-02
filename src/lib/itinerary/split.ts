/**
 * Stay-length analysis and multi-city suggestions. Pure functions (unit-tested).
 *
 * A destination's "capacity" is how many days it comfortably fills at the traveller's pace:
 * the editorial recommended stay, reduced when there are few things to see. Only when the trip is
 * longer than that do we suggest adding a nearby place — never otherwise.
 */
import type { NearbyOption, Leg } from "@/lib/nearby";
import type { TripPreferences } from "./types";

export const PER_DAY = { relaxed: 2, balanced: 3, packed: 4 } as const;

export interface SegmentLeg {
  mode: Leg["mode"];
  minutes: number;
  direct: boolean;
  source: Leg["source"];
  note?: string | null;
  distanceKm: number;
}

/** One part of a multi-city trip. The first segment is always the main (base) destination. */
export interface TripSegment {
  slug: string;
  destinationId: string;
  name: string;
  countryCode: string;
  lat: number;
  lng: number;
  /** Days spent on this segment (a day trip is always 1). */
  days: number;
  type: "base" | "stay" | "day_trip";
  /** How to get here from the base (for stays: from the previous segment). */
  leg?: SegmentLeg | null;
}

export interface SplitOption {
  id: string;
  extras: TripSegment[];
  baseDays: number;
}

export interface SplitSuggestion {
  totalDays: number;
  capacity: number;
  recommendedMin: number;
  recommendedMax: number;
  options: SplitOption[];
}

export interface BaseInfo {
  slug: string;
  destinationId: string;
  name: string;
  countryCode: string;
  lat: number;
  lng: number;
  daysMin: number;
  daysMax: number;
  placeCount: number;
}

export type NearbyWithId = NearbyOption & { destinationId: string };

/** Days a destination comfortably fills at a given pace. */
export function stayCapacity(base: Pick<BaseInfo, "daysMin" | "daysMax" | "placeCount">, pace: TripPreferences["pace"]): number {
  const contentDays = base.placeCount > 0 ? Math.ceil(base.placeCount / PER_DAY[pace]) : base.daysMin;
  return Math.max(1, Math.min(base.daysMax, Math.max(base.daysMin, contentDays)));
}

const legOf = (l: Leg): SegmentLeg => ({ mode: l.mode, minutes: l.minutes, direct: l.direct, source: l.source, note: l.note ?? null, distanceKm: l.distanceKm });

function segmentFrom(n: NearbyWithId, days: number, type: "stay" | "day_trip"): TripSegment {
  return { slug: n.slug, destinationId: n.destinationId, name: n.city, countryCode: n.countryCode, lat: n.lat, lng: n.lng, days, type, leg: legOf(n.leg) };
}

/**
 * Suggests how to use extra days: a day trip, a stay in a nearby city, or both.
 * Returns null when the trip length suits the destination (or nothing practical is nearby).
 */
export function suggestSplit(base: BaseInfo, totalDays: number, pace: TripPreferences["pace"], nearby: NearbyWithId[], maxOptions = 3): SplitSuggestion | null {
  const capacity = stayCapacity(base, pace);
  const excess = totalDays - capacity;
  if (excess <= 0 || totalDays < 2) return null;

  // Practical options only: day trips by ground transport within ~2 h door to door; stays within ~5.5 h.
  const dayTrips = nearby.filter((n) => n.suitability === "day_trip" && n.leg.mode !== "flight");
  // Overnight stays: places worth more than a day trip. Day-trip places only if nothing else is practical.
  const staysAll = nearby.filter((n) => n.leg.effectiveMinutes <= 330);
  const realStays = staysAll.filter((n) => n.suitability !== "day_trip" || n.daysMax >= 2);
  const stays = realStays.length ? realStays : staysAll;
  const minBaseDays = Math.max(1, Math.min(base.daysMin, totalDays - 1));
  const options: SplitOption[] = [];
  const seen = new Set<string>();
  const add = (extras: TripSegment[]) => {
    const key = extras.map((e) => `${e.slug}:${e.days}:${e.type}`).join("|");
    if (seen.has(key) || !extras.length) return;
    const extraDays = extras.reduce((s, e) => s + (e.type === "day_trip" ? 0 : e.days), 0);
    const baseDays = totalDays - extraDays;
    if (baseDays < minBaseDays) return;
    seen.add(key);
    options.push({ id: key, extras, baseDays });
  };

  // 1) A stay elsewhere — the main suggestion when there are 2+ spare days.
  const stayOptions = () => {
    for (const n of stays) {
      if (n.suitability === "multi_day" && excess < 2) continue; // long journeys need at least 2 nights there
      const want = Math.max(n.daysMin, Math.min(excess, n.daysMax));
      const days = Math.min(want, totalDays - minBaseDays);
      if (days < 1 || (n.suitability !== "day_trip" && days < Math.min(2, n.daysMin))) continue;
      const extras = [segmentFrom(n, days, "stay")];
      // Still spare base days after the stay? Add the best day trip from the base too.
      const left = totalDays - days - capacity;
      const trip = left >= 1 ? dayTrips.find((d) => d.slug !== n.slug) : undefined;
      if (trip) extras.unshift(segmentFrom(trip, 1, "day_trip"));
      add(extras);
    }
  };
  // 2) Day trips — the main suggestion for a single spare day.
  const dayTripOptions = () => {
    for (const d of dayTrips) {
      const extras = [segmentFrom(d, 1, "day_trip")];
      if (excess >= 2) {
        const second = dayTrips.find((x) => x.slug !== d.slug);
        if (second) extras.push(segmentFrom(second, 1, "day_trip"));
      }
      add(extras);
    }
  };
  if (excess >= 2) {
    stayOptions();
    dayTripOptions();
  } else {
    dayTripOptions();
    stayOptions();
  }
  if (!options.length) return null;
  return { totalDays, capacity, recommendedMin: base.daysMin, recommendedMax: base.daysMax, options: options.slice(0, maxOptions) };
}

/** The full ordered plan for an accepted option: base first, day trips inside the base stay, then stays. */
export function segmentsFor(base: BaseInfo, option: SplitOption): TripSegment[] {
  const baseSeg: TripSegment = { slug: base.slug, destinationId: base.destinationId, name: base.name, countryCode: base.countryCode, lat: base.lat, lng: base.lng, days: option.baseDays, type: "base", leg: null };
  return [baseSeg, ...option.extras.filter((e) => e.type === "day_trip"), ...option.extras.filter((e) => e.type === "stay")];
}

export type DayKind = "normal" | "travel" | "day_trip";

export interface DaySlot {
  index: number;
  segment: TripSegment;
  kind: DayKind;
  /** For travel days and day trips: where the traveller sets off from. */
  from?: TripSegment;
}

/**
 * Lays the segments out over the trip's days:
 *  • base days first; day trips go on the 2nd base day onward (never the arrival day);
 *  • each further stay starts with a travel day from the previous stay.
 */
export function layoutDays(segments: TripSegment[], totalDays: number): DaySlot[] {
  if (!segments.length) return [];
  const base = segments[0];
  const dayTrips = segments.filter((s) => s.type === "day_trip");
  const stays = segments.filter((s) => s.type === "stay");
  const slots: DaySlot[] = [];
  const baseDays = Math.max(1, totalDays - stays.reduce((s, x) => s + x.days, 0));
  // Spread day trips through the middle of the base stay.
  const tripDayIndexes = new Set<number>();
  dayTrips.forEach((_, i) => tripDayIndexes.add(Math.min(baseDays - 1, 1 + i * 2)));
  let tripCursor = 0;
  for (let i = 0; i < baseDays; i++) {
    if (tripDayIndexes.has(i) && tripCursor < dayTrips.length && baseDays > 1) slots.push({ index: i, segment: dayTrips[tripCursor++], kind: "day_trip", from: base });
    else slots.push({ index: i, segment: base, kind: "normal" });
  }
  let prev = base;
  for (const s of stays) {
    for (let d = 0; d < s.days && slots.length < totalDays; d++) {
      slots.push({ index: slots.length, segment: s, kind: d === 0 ? "travel" : "normal", from: d === 0 ? prev : undefined });
    }
    prev = s;
  }
  while (slots.length < totalDays) slots.push({ index: slots.length, segment: prev, kind: "normal" });
  return slots.slice(0, totalDays);
}

/**
 * An option built from a nearby place the traveller picked themselves ("replace" flow).
 * Returns null when the choice isn't practical (e.g. a day trip that needs a flight).
 */
export function customOption(base: BaseInfo, totalDays: number, n: NearbyWithId, type: "stay" | "day_trip"): SplitOption | null {
  if (totalDays < 2) return null;
  if (type === "day_trip") {
    if (n.suitability !== "day_trip" || n.leg.mode === "flight") return null;
    const extras = [segmentFrom(n, 1, "day_trip")];
    return { id: `${n.slug}:1:day_trip`, extras, baseDays: totalDays };
  }
  if (n.leg.effectiveMinutes > 330) return null;
  const minBaseDays = Math.max(1, Math.min(base.daysMin, totalDays - 1));
  const days = Math.max(1, Math.min(Math.max(n.daysMax, 1), totalDays - minBaseDays));
  if (totalDays - days < 1) return null;
  return { id: `${n.slug}:${days}:stay`, extras: [segmentFrom(n, days, "stay")], baseDays: totalDays - days };
}
