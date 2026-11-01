/**
 * Rules-based itinerary planner. Pure and deterministic (unit-tested), used:
 *  • as the primary planner when no AI provider is configured, and
 *  • as the fallback whenever the AI response is missing or invalid.
 * It only schedules places that exist in the database — it never invents venues or prices.
 */
import { chooseMode, estimateLeg, haversineMeters, type LatLng } from "@/lib/geo";
import type { CandidatePlace, PlannedDay, PlannedStop, TripPreferences } from "./types";

const PER_DAY = { relaxed: 2, balanced: 3, packed: 4 } as const;
const RADIUS_M = { low: 2_000, medium: 4_000, high: 7_000 } as const;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}
export function toHHMM(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function dayStartTime(prefs: Pick<TripPreferences, "morning">): string {
  return prefs.morning === "early" ? "08:00" : "09:30";
}

export function scorePlace(p: CandidatePlace, prefs: Pick<TripPreferences, "interests" | "children">, seedRank = 0): number {
  const interests = new Set<string>(prefs.interests);
  let s = 1 + seedRank;
  for (const tag of p.tags) if (interests.has(tag)) s += 2;
  if (p.tags.includes("landmark")) s += 0.75;
  if (prefs.children > 0 && p.tags.includes("family")) s += 1;
  return s;
}

function orderNearestNeighbour<T extends LatLng>(items: T[], start: LatLng | null): T[] {
  if (items.length <= 1) return items.slice();
  const rest = items.slice();
  const out: T[] = [];
  let cursor: LatLng = start ?? rest[0];
  while (rest.length) {
    let best = 0;
    let bestD = Infinity;
    rest.forEach((p, i) => {
      const d = haversineMeters(cursor, p);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const [next] = rest.splice(best, 1);
    out.push(next);
    cursor = next;
  }
  return out;
}

/** Pick a geographically coherent set of places for one day. */
export function pickDayCluster(pool: CandidatePlace[], scores: Map<string, number>, count: number, radius: number, seed: CandidatePlace[] = []): CandidatePlace[] {
  const chosen = seed.slice();
  const available = pool.filter((p) => !chosen.some((c) => c.id === p.id)).sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
  if (!chosen.length && available.length) chosen.push(available.shift()!);
  while (chosen.length < count && available.length) {
    const center = { lat: chosen.reduce((s, p) => s + p.lat, 0) / chosen.length, lng: chosen.reduce((s, p) => s + p.lng, 0) / chosen.length };
    let bestIdx = -1;
    let bestValue = -Infinity;
    available.forEach((p, i) => {
      const d = haversineMeters(center, p);
      // Prefer high-interest places, penalise distance; hard preference for the radius.
      const value = (scores.get(p.id) ?? 0) - d / 1500 - (d > radius ? 100 : 0);
      if (value > bestValue) {
        bestValue = value;
        bestIdx = i;
      }
    });
    if (bestIdx < 0) break;
    chosen.push(available.splice(bestIdx, 1)[0]);
  }
  return chosen;
}

function attractionStop(p: CandidatePlace, locked = false): PlannedStop {
  return {
    kind: p.kind === "activity" ? "activity" : "attraction",
    title: p.name,
    placeId: p.id,
    lat: p.lat,
    lng: p.lng,
    durationMin: p.durationMin ?? 90,
    locked,
  };
}

function mealStop(mealType: NonNullable<PlannedStop["mealType"]>, near: CandidatePlace | PlannedStop | null, duration: number): PlannedStop {
  const area = near ? ("neighborhood" in near && near.neighborhood ? near.neighborhood : "title" in near ? near.title : (near as CandidatePlace).name) : "";
  return {
    kind: mealType === "snack" ? "break" : "meal",
    mealType,
    // Generic meal blocks store the area name; the UI renders "Lunch near {area}" in the user's language
    // and links to a live map search filtered by the traveller's food preferences.
    title: area,
    lat: near?.lat ?? null,
    lng: near?.lng ?? null,
    durationMin: duration,
    locked: false,
  };
}

/** Recomputes start times and travel legs for an ordered list of stops. */
export function scheduleDay(stops: PlannedStop[], startTime: string, transport: TripPreferences["transport"]): PlannedStop[] {
  let cursor = toMinutes(startTime);
  const out = stops.map((s) => ({ ...s }));
  out.forEach((stop, i) => {
    if (stop.mealType === "lunch" && cursor < toMinutes("12:00") && toMinutes("12:00") - cursor <= 60) cursor = toMinutes("12:00");
    if (stop.mealType === "dinner" && cursor < toMinutes("19:00")) cursor = toMinutes("19:00");
    stop.startTime = toHHMM(cursor);
    cursor += stop.durationMin;
    const next = out[i + 1];
    if (next && stop.lat != null && stop.lng != null && next.lat != null && next.lng != null) {
      // Keep a provider-supplied leg if one exists and the endpoints haven't changed.
      if (stop.travelSource !== "provider" || stop.travelMinutes == null) {
        const mode = chooseMode(transport, haversineMeters(stop as LatLng, next as LatLng));
        const leg = estimateLeg(stop as LatLng, next as LatLng, mode);
        stop.travelMode = mode;
        stop.travelMinutes = leg.minutes;
        stop.travelMeters = leg.meters;
        stop.travelSource = "estimate";
      }
      cursor += stop.travelMinutes ?? 0;
    } else {
      stop.travelMode = null;
      stop.travelMinutes = null;
      stop.travelMeters = null;
      stop.travelSource = null;
    }
  });
  return out;
}

export interface BuildDayInput {
  dayIndex: number;
  date: string | null;
  prefs: TripPreferences;
  pool: CandidatePlace[]; // places not used on other days
  scores: Map<string, number>;
  lockedStops?: PlannedStop[]; // kept as-is on regeneration
  start?: LatLng | null; // accommodation
  isArrivalDay?: boolean;
  isDepartureDay?: boolean;
}

export function buildDay(input: BuildDayInput): { day: PlannedDay; used: string[] } {
  const { prefs, pool, scores } = input;
  const locked = input.lockedStops ?? [];
  const lockedPlaceIds = new Set(locked.map((s) => s.placeId).filter(Boolean) as string[]);
  let target: number = PER_DAY[prefs.pace];
  if (prefs.activityBalance === "more_activities") target += 1;
  if (prefs.activityBalance === "more_free_time") target -= 1;
  if (input.isArrivalDay || input.isDepartureDay) target -= 1;
  target = Math.max(1, Math.min(5, target));

  const lockedAttractions = locked.filter((s) => s.kind === "attraction" || s.kind === "activity" || s.kind === "custom");
  const seedPlaces: CandidatePlace[] = lockedAttractions
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => ({ id: s.placeId ?? `locked-${s.title}`, name: s.title, kind: s.kind, tags: [], durationMin: s.durationMin, neighborhood: null, lat: s.lat!, lng: s.lng! }));
  const freePool = pool.filter((p) => !lockedPlaceIds.has(p.id));
  const picked = pickDayCluster(freePool, scores, Math.max(target, seedPlaces.length), RADIUS_M[prefs.walking], seedPlaces);
  const newPlaces = picked.filter((p) => !seedPlaces.some((s) => s.id === p.id));

  const attractionStops: PlannedStop[] = [
    ...lockedAttractions,
    ...newPlaces.map((p) => attractionStop(p)),
  ];
  const coordsStops = attractionStops.filter((s) => s.lat != null && s.lng != null) as (PlannedStop & LatLng)[];
  const noCoords = attractionStops.filter((s) => s.lat == null || s.lng == null);
  const ordered: PlannedStop[] = [...orderNearestNeighbour(coordsStops, input.start ?? null), ...noCoords];

  const placeById = new Map(picked.map((p) => [p.id, p]));
  const nearFor = (s: PlannedStop | undefined): CandidatePlace | PlannedStop | null => (s ? (s.placeId && placeById.get(s.placeId)) || s : null);
  const lockedMeal = (type: string) => locked.find((s) => s.mealType === type);
  const meal = (type: NonNullable<PlannedStop["mealType"]>, near: PlannedStop | undefined, dur: number) => lockedMeal(type) ?? mealStop(type, nearFor(near), dur);

  // Assemble the day by simulating the clock so meals land at realistic times.
  const startTime = input.isArrivalDay && prefs.departureTime ? toHHMM(Math.max(toMinutes(dayStartTime(prefs)), toMinutes("12:00"))) : dayStartTime(prefs);
  const legMinutes = (a: PlannedStop | undefined, b: PlannedStop | undefined) =>
    a?.lat != null && a?.lng != null && b?.lat != null && b?.lng != null
      ? estimateLeg(a as LatLng, b as LatLng, chooseMode(prefs.transport, haversineMeters(a as LatLng, b as LatLng))).minutes
      : 0;
  const stops: PlannedStop[] = [];
  const n = ordered.length;
  let clock = toMinutes(startTime);
  let lunchDone = false;
  let snackDone = false;
  const push = (s: PlannedStop) => {
    clock += legMinutes(stops[stops.length - 1], s);
    if (s.mealType === "lunch" && clock < toMinutes("12:00")) clock = toMinutes("12:00");
    stops.push(s);
    clock += s.durationMin;
  };
  if (!input.isArrivalDay && clock < toMinutes("11:00")) push(meal("breakfast", ordered[0], 45));
  ordered.forEach((a, i) => {
    const prev = ordered[i - 1];
    const arrive = clock + legMinutes(stops[stops.length - 1], a);
    if (!lunchDone && (arrive >= toMinutes("12:15") || (arrive >= toMinutes("11:30") && arrive + a.durationMin > toMinutes("14:00")))) {
      push(meal("lunch", prev ?? a, 75));
      lunchDone = true;
    }
    if (lunchDone && !snackDone && n >= 3 && clock >= toMinutes("15:30") && clock <= toMinutes("17:30")) {
      push(meal("snack", prev ?? a, 30));
      snackDone = true;
    }
    push(a);
  });
  const last = ordered[n - 1];
  if (!lunchDone && clock <= toMinutes("15:00")) push(meal("lunch", last, 75));
  if (!snackDone && n >= 2 && clock >= toMinutes("15:00") && clock <= toMinutes("17:00")) push(meal("snack", last, 30));
  if (!input.isDepartureDay) {
    const gap = toMinutes("19:00") - clock - 15;
    if (gap >= 60) {
      stops.push({ kind: "break", mealType: null, title: last?.title ?? prefs.destinationName, lat: last?.lat ?? null, lng: last?.lng ?? null, durationMin: Math.min(gap, 240), locked: false });
      clock += Math.min(gap, 240);
    }
    push(meal("dinner", last, 90));
    if (prefs.interests.includes("nightlife")) push(meal("drinks", last, 75));
  }
  // Any other locked stops (e.g. a locked custom break) that weren't placed yet go at the end.
  for (const s of locked) if (!stops.includes(s)) stops.push(s);

  const scheduled = scheduleDay(stops, startTime, prefs.transport);
  const hoods = Array.from(new Set(ordered.map((s) => (s.placeId ? placeById.get(s.placeId)?.neighborhood : null)).filter(Boolean))) as string[];
  const title = hoods.slice(0, 2).join(" · ") || ordered.slice(0, 2).map((s) => s.title).join(" · ") || prefs.destinationName;

  return {
    day: { dayIndex: input.dayIndex, date: input.date, title, startTime, stops: scheduled },
    used: newPlaces.map((p) => p.id),
  };
}

export function enumerateDates(start: string, end: string, maxDays: number): string[] {
  const out: string[] = [];
  let t = Date.parse(start + "T00:00:00Z");
  const stop = Date.parse(end + "T00:00:00Z");
  while (t <= stop && out.length < maxDays) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += 86_400_000;
  }
  return out;
}

export function buildItinerary(prefs: TripPreferences, places: CandidatePlace[], maxDays: number): PlannedDay[] {
  const dates = enumerateDates(prefs.startDate, prefs.endDate, maxDays);
  const scores = new Map(places.map((p, i) => [p.id, scorePlace(p, prefs, (places.length - i) / places.length)]));
  const start = prefs.accommodation.lat != null && prefs.accommodation.lng != null ? { lat: prefs.accommodation.lat, lng: prefs.accommodation.lng } : null;
  let remaining = places.slice();
  return dates.map((date, i) => {
    const { day, used } = buildDay({
      dayIndex: i,
      date,
      prefs,
      pool: remaining,
      scores,
      start,
      isArrivalDay: dates.length > 1 && i === 0 && Boolean(prefs.departureTime),
      isDepartureDay: dates.length > 1 && i === dates.length - 1 && Boolean(prefs.returnTime),
    });
    remaining = remaining.filter((p) => !used.includes(p.id));
    return day;
  });
}
