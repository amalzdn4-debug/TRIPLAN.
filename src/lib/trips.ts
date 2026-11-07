import "server-only";
import { and, asc, desc, eq, inArray, ne, sql, gt, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { MAX_TRIP_DAYS } from "@/config/site";
import { getActiveSubscriptions, isAdminUser, type Entitlement } from "@/lib/entitlements";
import { buildDay, buildItinerary, buildPlan, enumerateDates, scheduleDay, scorePlace, dayStartTime, toHHMM } from "@/lib/itinerary/engine";
import { customOption, layoutDays, segmentsFor, suggestSplit, type SplitOption, type BaseInfo, type NearbyWithId, type SplitSuggestion, type TripSegment } from "@/lib/itinerary/split";
import { getDestinationCards, getNearby } from "@/lib/destinations";
import { accommodationLinks, type OutboundLink } from "@/lib/links";
import { withPartners } from "@/lib/affiliates";
import { generateWithAI } from "@/lib/itinerary/ai";
import { refineLegs } from "@/lib/itinerary/routing";
import { haversineMeters, type LatLng } from "@/lib/geo";
import { applyLogistics, applyLogisticsAt, arrivalReadyMinutes, insertionIndex, pinLogistics, staysFor, type LogisticsContext, type Station } from "@/lib/itinerary/logistics";
import type { BookedStay, CandidatePlace, IntercityDetails, PlannedDay, PlannedStop, StopDetails, TravelEnd, TripPreferences } from "@/lib/itinerary/types";
import { FREE_TRIPS_INCLUDED } from "@/config/site";

export class NeedsPaymentError extends Error {
  /** "period_limit" = a subscription's trips for this billing month are used up. */
  constructor(public reason: "limit" | "period_limit" = "limit") {
    super("needs_payment");
  }
}

/* ───────────── Serializable view types (sent to client components) ───────────── */

export interface StopView {
  id: string;
  dayId: string;
  position: number;
  kind: PlannedStop["kind"];
  mealType: PlannedStop["mealType"];
  title: string;
  description: string | null;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  startTime: string | null;
  durationMin: number;
  costMin: number | null;
  costMax: number | null;
  costCurrency: string | null;
  costBasis: "per_person" | "total" | null;
  costStatus: "estimated" | "confirmed" | null;
  linkUrl: string | null;
  linkLabel: string | null;
  locked: boolean;
  travelMode: "walking" | "transit" | "driving" | "cycling" | null;
  travelMinutes: number | null;
  travelMeters: number | null;
  travelSource: "provider" | "estimate" | null;
  /** Intercity journey details (typical time, not a timetable). */
  intercity: IntercityDetails | null;
  /** The place's official website (from Wikidata or an editor), if known. Never invented. */
  officialUrl: string | null;
  /** Usually needs a ticket / has opening hours worth checking (museums, palaces, theatres…). */
  ticketed: boolean;
  /** Accommodation/airport/station/luggage steps added by the planner (null for sights and meals). */
  logistics: Omit<StopDetails, "intercity"> | null;
}

export interface DayView {
  id: string;
  dayIndex: number;
  date: string | null;
  title: string;
  startTime: string;
  notes: string | null;
  /** Destination this day is spent in (falls back to the trip's main destination). */
  destinationId: string | null;
  kind: "normal" | "travel" | "day_trip";
  stops: StopView[];
}

export interface TripView {
  id: string;
  title: string;
  mode: "fast" | "detailed";
  status: "draft" | "planned" | "completed";
  destinationId: string | null;
  destinationSlug: string | null;
  destinationName: string;
  departureCity: string | null;
  startDate: string | null;
  endDate: string | null;
  adults: number;
  children: number;
  budgetTotal: number | null;
  currency: string;
  preferences: TripPreferences;
  generationSource: "rules" | "ai" | null;
  updatedAt: string;
  days: DayView[];
}

const num = (v: string | number | null | undefined) => (v == null ? null : Number(v));

function toStopView(s: typeof schema.itineraryStops.$inferSelect): StopView {
  return {
    id: s.id,
    dayId: s.dayId,
    position: s.position,
    kind: s.kind,
    mealType: s.mealType,
    title: s.title,
    description: s.description,
    placeId: s.placeId,
    lat: s.lat,
    lng: s.lng,
    address: s.address,
    startTime: s.startTime,
    durationMin: s.durationMin,
    costMin: num(s.costMin),
    costMax: num(s.costMax),
    costCurrency: s.costCurrency,
    costBasis: s.costBasis,
    costStatus: s.costStatus,
    linkUrl: s.linkUrl,
    linkLabel: s.linkLabel,
    locked: s.locked,
    travelMode: s.travelMode,
    travelMinutes: s.travelMinutes,
    travelMeters: s.travelMeters,
    travelSource: s.travelSource,
    intercity: s.details?.intercity ?? null,
    officialUrl: null,
    ticketed: false,
    logistics: s.details?.role ? (({ intercity: _i, ...rest }) => rest)(s.details) : null,
  };
}

/* ───────────── Queries ───────────── */

export async function listTrips(userId: string) {
  const db = await getDb();
  return db
    .select({
      id: schema.trips.id,
      title: schema.trips.title,
      status: schema.trips.status,
      mode: schema.trips.mode,
      destinationName: schema.trips.destinationName,
      destinationSlug: schema.destinations.slug,
      startDate: schema.trips.startDate,
      endDate: schema.trips.endDate,
      updatedAt: schema.trips.updatedAt,
      dayCount: sql<number>`(select count(*)::int from itinerary_days d where d.trip_id = ${schema.trips.id})`,
    })
    .from(schema.trips)
    .leftJoin(schema.destinations, eq(schema.destinations.id, schema.trips.destinationId))
    .where(eq(schema.trips.userId, userId))
    .orderBy(desc(schema.trips.updatedAt));
}

/** Loads a trip only if it belongs to `userId` — the ownership check for every trip operation. */
export async function getTrip(tripId: string, userId: string): Promise<TripView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) return null;
  const db = await getDb();
  const rows = await db
    .select({ t: schema.trips, slug: schema.destinations.slug })
    .from(schema.trips)
    .leftJoin(schema.destinations, eq(schema.destinations.id, schema.trips.destinationId))
    .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const days = await db.select().from(schema.itineraryDays).where(eq(schema.itineraryDays.tripId, tripId)).orderBy(asc(schema.itineraryDays.dayIndex));
  const stops = await db.select().from(schema.itineraryStops).where(eq(schema.itineraryStops.tripId, tripId)).orderBy(asc(schema.itineraryStops.position));
  // Official websites and "needs a ticket" hints come from the places themselves, so older trips get them too.
  const placeIds = [...new Set(stops.map((s) => s.placeId).filter(Boolean) as string[])];
  const placeInfo = new Map<string, { url: string | null; ticketed: boolean }>();
  if (placeIds.length) {
    const rows = await db
      .select({ id: schema.places.id, url: schema.places.websiteUrl, tags: schema.places.tags, details: schema.places.details })
      .from(schema.places)
      .where(inArray(schema.places.id, placeIds));
    for (const r of rows) {
      const details = (r.details ?? {}) as { ticketed?: boolean };
      placeInfo.set(r.id, { url: r.url && /^https:\/\//.test(r.url) ? r.url : null, ticketed: Boolean(details.ticketed) || r.tags.includes("museums") });
    }
  }
  const view = (s: (typeof stops)[number]): StopView => {
    const v = toStopView(s);
    const info = s.placeId ? placeInfo.get(s.placeId) : undefined;
    return info ? { ...v, officialUrl: info.url, ticketed: info.ticketed } : v;
  };
  const t = row.t;
  return {
    id: t.id,
    title: t.title,
    mode: t.mode,
    status: t.status,
    destinationId: t.destinationId,
    destinationSlug: row.slug,
    destinationName: t.destinationName,
    departureCity: t.departureCity,
    startDate: t.startDate,
    endDate: t.endDate,
    adults: t.adults,
    children: t.children,
    budgetTotal: num(t.budgetTotal),
    currency: t.currency,
    preferences: t.preferences as unknown as TripPreferences,
    generationSource: t.generationSource,
    updatedAt: t.updatedAt.toISOString(),
    days: days.map((d) => ({
      id: d.id,
      dayIndex: d.dayIndex,
      date: d.date,
      title: d.title,
      startTime: d.startTime,
      notes: d.notes,
      destinationId: d.destinationId ?? t.destinationId,
      kind: d.kind,
      stops: stops.filter((s) => s.dayId === d.id).map(view),
    })),
  };
}

export async function getCandidatePlaces(destinationId: string | null): Promise<CandidatePlace[]> {
  if (!destinationId) return [];
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.places)
    .where(and(eq(schema.places.destinationId, destinationId), inArray(schema.places.kind, ["attraction", "activity"])))
    .orderBy(asc(schema.places.createdAt));
  return rows.map((p) => ({ id: p.id, name: p.name, kind: p.kind, tags: p.tags, durationMin: p.durationMin, neighborhood: p.neighborhood, lat: p.lat, lng: p.lng, popularity: p.popularity }));
}

/* ───────────── Multi-city planning ───────────── */

const isMultiCity = (prefs: TripPreferences) => (prefs.segments?.length ?? 0) > 1;

/** Number of days in the trip (dates capped at MAX_TRIP_DAYS). */
function tripDates(prefs: TripPreferences) {
  return enumerateDates(prefs.startDate, prefs.endDate, MAX_TRIP_DAYS);
}

/** Stay-length analysis for a trip's main destination, plus practical nearby places (with ids). */
export async function getPlanningContext(destinationId: string | null, locale: string): Promise<{ base: BaseInfo; nearby: (NearbyWithId & { summary: string })[] } | null> {
  if (!destinationId) return null;
  const cards = await getDestinationCards(locale);
  const card = cards.find((c) => c.id === destinationId);
  if (!card) return null;
  const nearby = await getNearby(card.slug, locale, 8);
  return {
    base: { slug: card.slug, destinationId: card.id, name: card.city, countryCode: card.countryCode, lat: card.lat, lng: card.lng, daysMin: card.daysMin ?? 2, daysMax: card.daysMax ?? card.daysMin ?? 3, placeCount: card.placeCount },
    nearby,
  };
}

/** The suggestion shown on a trip, or null (already answered, multi-city already, or nothing to suggest). */
export async function getSplitSuggestion(trip: Pick<TripView, "destinationId" | "preferences">, locale: string): Promise<(SplitSuggestion & { baseName: string }) | null> {
  const prefs = trip.preferences;
  if (prefs.splitDecision || isMultiCity(prefs)) return null;
  const ctx = await getPlanningContext(trip.destinationId, locale);
  if (!ctx) return null;
  const s = suggestSplit(ctx.base, tripDates(prefs).length, prefs.pace, ctx.nearby);
  return s ? { ...s, baseName: ctx.base.name } : null;
}

export interface NearbyChoice {
  slug: string;
  destinationId: string;
  city: string;
  countryCode: string;
  summary: string;
  mode: NearbyWithId["leg"]["mode"];
  minutes: number;
  direct: boolean;
  source: NearbyWithId["leg"]["source"];
  distanceKm: number;
  suitability: NearbyWithId["suitability"];
}

export interface StayArea {
  destinationId: string;
  /** Destination slug (to save a booked stay for this city). */
  slug: string | null;
  city: string;
  /** The neighbourhood closest to the planned sights overall (from the places data), if known. */
  area: string | null;
  lat: number;
  lng: number;
  /** Planned sights within about 2.5 km of the suggested base. */
  sights: number;
  checkIn: string | null;
  checkOut: string | null;
  links: OutboundLink[];
}

export interface TripPlanning {
  suggestion: (SplitSuggestion & { baseName: string }) | null;
  /** Practical nearby places the traveller can pick instead of the suggestion. */
  nearby: NearbyChoice[];
  /** Where to stay, for each place the traveller sleeps in and hasn't booked. */
  stayAreas: StayArea[];
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Everything the trip workspace needs for the multi-city and accommodation steps. */
export async function getTripPlanning(trip: TripView, locale: string): Promise<TripPlanning> {
  const prefs = trip.preferences;
  const ctx = await getPlanningContext(trip.destinationId, locale).catch(() => null);
  const suggestion = ctx && !prefs.splitDecision && !isMultiCity(prefs) ? suggestSplit(ctx.base, tripDates(prefs).length, prefs.pace, ctx.nearby) : null;
  const nearby: NearbyChoice[] = (ctx?.nearby ?? [])
    .filter((n) => n.leg.effectiveMinutes <= 330)
    .map((n) => ({ slug: n.slug, destinationId: n.destinationId, city: n.city, countryCode: n.countryCode, summary: n.summary, mode: n.leg.mode, minutes: n.leg.minutes, direct: n.leg.direct, source: n.leg.source, distanceKm: n.leg.distanceKm, suitability: n.suitability }));

  // Where to stay: group sleeping days (not day trips) by destination.
  const segments = isMultiCity(prefs) ? prefs.segments! : null;
  const nameOf = (id: string | null) => segments?.find((x) => x.destinationId === id)?.name ?? (id === trip.destinationId ? trip.destinationName : null);
  const groups = new Map<string, DayView[]>();
  for (const d of trip.days) {
    if (d.kind === "day_trip" || !d.destinationId) continue;
    groups.set(d.destinationId, [...(groups.get(d.destinationId) ?? []), d]);
  }
  const placeIds = trip.days.flatMap((d) => d.stops.map((s) => s.placeId)).filter(Boolean) as string[];
  const db = await getDb();
  const hoods = placeIds.length
    ? new Map((await db.select({ id: schema.places.id, n: schema.places.neighborhood }).from(schema.places).where(inArray(schema.places.id, placeIds))).map((r) => [r.id, r.n]))
    : new Map<string, string | null>();
  const booked = prefs.accommodation?.status === "booked" && prefs.accommodation.lat != null;
  const stayAreas: StayArea[] = [];
  for (const [destId, days] of groups) {
    if (booked && destId === trip.destinationId) continue; // the booked place is in the main destination
    const sights = days.flatMap((d) => d.stops).filter((s) => (s.kind === "attraction" || s.kind === "activity") && s.lat != null && s.lng != null) as (StopView & { lat: number; lng: number })[];
    const city = nameOf(destId);
    if (!city) continue;
    const seg = segments?.find((x) => x.destinationId === destId);
    if (seg && prefs.stays?.[seg.slug]?.name) continue; // already booked in this city
    let area: string | null = null;
    let lat = seg?.lat ?? NaN;
    let lng = seg?.lng ?? NaN;
    let near = 0;
    if (sights.length) {
      // Candidate bases: the centre of each neighbourhood with planned sights, plus the centre of
      // all sights. Pick the one with the shortest total distance to everything planned there.
      const byHood = new Map<string, (typeof sights)[number][]>();
      for (const s of sights) {
        const h = s.placeId ? hoods.get(s.placeId) : null;
        if (h) byHood.set(h, [...(byHood.get(h) ?? []), s]);
      }
      const mid = (ps: { lat: number; lng: number }[]) => ({ lat: ps.reduce((t, p) => t + p.lat, 0) / ps.length, lng: ps.reduce((t, p) => t + p.lng, 0) / ps.length });
      const options = [{ area: null as string | null, at: mid(sights) }, ...[...byHood.entries()].map(([h, ps]) => ({ area: h as string | null, at: mid(ps) }))];
      const cost = (at: { lat: number; lng: number }) => sights.reduce((t, s) => t + haversineMeters(at, s), 0);
      // A named neighbourhood wins unless it's clearly worse (>15 %) than the plain centre point.
      const centre = cost(options[0].at);
      const named = options.slice(1).sort((x, y) => cost(x.at) - cost(y.at))[0];
      const best = named && cost(named.at) <= centre * 1.15 ? named : options[0];
      area = best.area;
      lat = best.at.lat;
      lng = best.at.lng;
      near = sights.filter((s) => haversineMeters(best.at, s) <= 2500).length;
    }
    if (!Number.isFinite(lat)) {
      const card = (await getDestinationCards(locale)).find((c) => c.id === destId);
      if (!card) continue;
      lat = card.lat;
      lng = card.lng;
    }
    const dates = days.map((d) => d.date).filter(Boolean) as string[];
    const checkIn = dates[0] ?? null;
    const checkOut = dates.length ? addDays(dates[dates.length - 1], 1) : null;
    const links = await withPartners(accommodationLinks(area ? `${area}, ${city}` : city, checkIn, checkOut, trip.adults), {
      source: "stay-area",
      destination: seg?.slug ?? trip.destinationSlug,
      city,
      checkin: checkIn,
      checkout: checkOut,
      adults: trip.adults,
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
      locale,
    });
    stayAreas.push({ destinationId: destId, slug: seg?.slug ?? trip.destinationSlug, city, area, lat, lng, sights: near, checkIn, checkOut, links });
  }
  return { suggestion: suggestion ? { ...suggestion, baseName: ctx!.base.name } : null, nearby, stayAreas };
}

/** Places for each destination in a multi-city trip, keyed by slug. */
async function placesBySegment(segments: TripSegment[]): Promise<Record<string, CandidatePlace[]>> {
  const out: Record<string, CandidatePlace[]> = {};
  for (const seg of segments) if (!out[seg.slug]) out[seg.slug] = (await getCandidatePlaces(seg.destinationId)).map((p) => ({ ...p, destinationSlug: seg.slug }));
  return out;
}

/* ───────────── Creation ───────────── */

/**
 * Atomically claims the right to create one trip, in this order: an unlimited subscription, a
 * subscription with trips left in its current billing period, the free trip, a purchased trip
 * credit. Throws NeedsPaymentError when none is left.
 */
async function claimEntitlement(userId: string): Promise<{ entitlement: Entitlement; subscriptionId: string | null }> {
  const db = await getDb();
  // The site owner tests freely: admin trips are unlimited and don't touch any counter.
  if (await isAdminUser(userId)) return { entitlement: "admin", subscriptionId: null };
  const bumpTotal = () => db.update(schema.users).set({ tripsCreatedTotal: sql`${schema.users.tripsCreatedTotal} + 1` }).where(eq(schema.users.id, userId));
  const subs = await getActiveSubscriptions(userId);
  for (const s of subs) {
    if (s.tripsIncluded == null) {
      await bumpTotal();
      return { entitlement: "subscription", subscriptionId: s.id };
    }
    // Conditional increment: two simultaneous requests can't both take the last trip of a period.
    const claimed = await db
      .update(schema.subscriptions)
      .set({ tripsUsedInPeriod: sql`${schema.subscriptions.tripsUsedInPeriod} + 1` })
      .where(and(eq(schema.subscriptions.id, s.id), lt(schema.subscriptions.tripsUsedInPeriod, s.tripsIncluded)))
      .returning({ id: schema.subscriptions.id });
    if (claimed.length) {
      await bumpTotal();
      return { entitlement: "subscription", subscriptionId: s.id };
    }
  }
  const free = await db
    .update(schema.users)
    .set({ tripsCreatedTotal: sql`${schema.users.tripsCreatedTotal} + 1` })
    .where(and(eq(schema.users.id, userId), lt(schema.users.tripsCreatedTotal, FREE_TRIPS_INCLUDED)))
    .returning({ id: schema.users.id });
  if (free.length) return { entitlement: "free", subscriptionId: null };
  const credit = await db
    .update(schema.users)
    .set({ tripCredits: sql`${schema.users.tripCredits} - 1`, tripsCreatedTotal: sql`${schema.users.tripsCreatedTotal} + 1` })
    .where(and(eq(schema.users.id, userId), gt(schema.users.tripCredits, 0)))
    .returning({ id: schema.users.id });
  if (credit.length) return { entitlement: "credit", subscriptionId: null };
  throw new NeedsPaymentError(subs.length ? "period_limit" : "limit");
}

/** Stations, stays and editor-added luggage storage for a trip's destinations. */
async function logisticsFor(prefs: TripPreferences, baseId: string | null): Promise<{ ctx: LogisticsContext; centre: LatLng | null }> {
  const ids = [...new Set([baseId, ...(prefs.segments ?? []).map((s) => s.destinationId)].filter(Boolean) as string[])];
  const stations: Record<string, Station> = {};
  const luggage: NonNullable<LogisticsContext["luggage"]> = {};
  let centre: LatLng | null = prefs.segments?.[0] ? { lat: prefs.segments[0].lat, lng: prefs.segments[0].lng } : null;
  if (ids.length) {
    const db = await getDb();
    const rows = await db
      .select({ destinationId: schema.places.destinationId, kind: schema.places.kind, name: schema.places.name, lat: schema.places.lat, lng: schema.places.lng, popularity: schema.places.popularity, details: schema.places.details, url: schema.places.websiteUrl })
      .from(schema.places)
      .where(and(inArray(schema.places.destinationId, ids), inArray(schema.places.kind, ["transport_hub", "luggage_storage"])));
    // The main station = the most widely covered railway hub of each destination.
    for (const r of rows.filter((x) => x.kind === "transport_hub" && (x.details as { hub?: string })?.hub === "rail").sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))) {
      stations[r.destinationId] ??= { name: r.name, lat: r.lat, lng: r.lng };
    }
    for (const r of rows.filter((x) => x.kind === "luggage_storage")) (luggage[r.destinationId] ??= []).push({ name: r.name, lat: r.lat, lng: r.lng, url: r.url && /^https:\/\//.test(r.url) ? r.url : null });
    if (!centre && baseId) {
      const [c] = await db.select({ lat: schema.cities.lat, lng: schema.cities.lng }).from(schema.destinations).innerJoin(schema.cities, eq(schema.cities.id, schema.destinations.cityId)).where(eq(schema.destinations.id, baseId));
      if (c) centre = { lat: c.lat, lng: c.lng };
    }
  }
  return { ctx: { prefs, stays: staysFor(prefs, baseId), stations, baseDestinationId: baseId, luggage }, centre };
}

/** Adds the travel logistics, then refines legs with a routing provider when configured. */
async function finishDays(days: PlannedDay[], ctx: LogisticsContext, prefs: TripPreferences): Promise<PlannedDay[]> {
  const withLogistics = applyLogistics(days, ctx);
  return Promise.all(withLogistics.map(async (d) => ({ ...d, stops: scheduleDay(await refineLegs(d.stops), d.startTime, prefs.transport) })));
}

async function generateDays(prefs: TripPreferences, destinationId: string | null, locale: string, locked: Record<number, PlannedStop[]> = {}): Promise<{ days: PlannedDay[]; source: "ai" | "rules" }> {
  const { ctx, centre } = await logisticsFor(prefs, destinationId);
  const timing = { arrivalReady: centre ? arrivalReadyMinutes(prefs, ctx.stays[destinationId ?? ""] ?? null, centre) : null };
  if (isMultiCity(prefs)) {
    // Multi-city trips use the rules engine: it knows the journeys between places and never invents them.
    const segments = prefs.segments!;
    const dates = tripDates(prefs);
    const days = buildPlan({ prefs, slots: layoutDays(segments, dates.length), dates, places: await placesBySegment(segments), locked, timing });
    return { days: await finishDays(days, ctx, prefs), source: "rules" };
  }
  const places = await getCandidatePlaces(destinationId);
  const ai = await generateWithAI(prefs, places, MAX_TRIP_DAYS, locale);
  const days = ai ?? buildItinerary(prefs, places, MAX_TRIP_DAYS, timing);
  return { days: await finishDays(days, ctx, prefs), source: ai ? "ai" : "rules" };
}

function stopRow(tripId: string, dayId: string, s: PlannedStop, position: number) {
  const n = (v: number | null | undefined) => (v == null ? null : String(v));
  return {
    tripId,
    dayId,
    position,
    kind: s.kind,
    mealType: s.mealType ?? null,
    title: s.title.slice(0, 200),
    description: s.description ?? null,
    placeId: s.placeId && !s.placeId.startsWith("locked-") ? s.placeId : null,
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    address: s.address ?? null,
    startTime: s.startTime ?? null,
    durationMin: s.durationMin,
    costMin: n(s.costMin),
    costMax: n(s.costMax),
    costCurrency: s.costCurrency ?? null,
    costBasis: s.costBasis ?? null,
    costStatus: s.costStatus ?? null,
    linkUrl: s.linkUrl ?? null,
    linkLabel: s.linkLabel ?? null,
    locked: s.locked,
    travelMode: s.travelMode ?? null,
    travelMinutes: s.travelMinutes ?? null,
    travelMeters: s.travelMeters ?? null,
    travelSource: s.travelSource ?? null,
    details: s.details ?? null,
  };
}

async function persistDays(tripId: string, days: PlannedDay[]) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.itineraryDays).where(eq(schema.itineraryDays.tripId, tripId));
    for (const d of days) {
      const [day] = await tx
        .insert(schema.itineraryDays)
        .values({ tripId, dayIndex: d.dayIndex, date: d.date, title: d.title.slice(0, 200), startTime: d.startTime, destinationId: d.destinationId ?? null, kind: d.kind ?? "normal" })
        .returning({ id: schema.itineraryDays.id });
      if (d.stops.length) await tx.insert(schema.itineraryStops).values(d.stops.map((s, i) => stopRow(tripId, day.id, s, i)));
    }
    await tx.update(schema.trips).set({ updatedAt: new Date() }).where(eq(schema.trips.id, tripId));
  });
}

export async function createTrip(opts: { userId: string; mode: "fast" | "detailed"; prefs: TripPreferences; destinationId: string | null; title: string; locale: string; participants?: { name: string; isChild: boolean }[] }) {
  const { entitlement, subscriptionId } = await claimEntitlement(opts.userId);
  const db = await getDb();
  const p = opts.prefs;
  const [trip] = await db
    .insert(schema.trips)
    .values({
      userId: opts.userId,
      title: opts.title.slice(0, 140),
      mode: opts.mode,
      status: "draft",
      destinationId: opts.destinationId,
      destinationName: p.destinationName,
      departureCity: p.departureCity ?? null,
      startDate: p.startDate,
      endDate: p.endDate,
      adults: p.adults,
      children: p.children,
      budgetTotal: p.budgetTotal != null ? String(p.budgetTotal) : null,
      currency: p.currency,
      preferences: p as unknown as Record<string, unknown>,
      entitlement,
      subscriptionId,
    })
    .returning({ id: schema.trips.id });
  if (opts.participants?.length) {
    await db.insert(schema.tripParticipants).values(opts.participants.slice(0, 20).map((x) => ({ tripId: trip.id, name: x.name.slice(0, 80), isChild: x.isChild })));
  }
  try {
    const { days, source } = await generateDays(p, opts.destinationId, opts.locale);
    await persistDays(trip.id, days);
    await db.update(schema.trips).set({ status: "planned", generationSource: source }).where(eq(schema.trips.id, trip.id));
  } catch (err) {
    // The trip and the user's preferences are saved even if generation fails; the user can retry.
    console.error("[trips] generation failed", err);
  }
  return trip.id;
}

/* ───────────── Editing (all scoped by owner) ───────────── */

async function assertOwner(tripId: string, userId: string) {
  const db = await getDb();
  const [t] = await db.select({ id: schema.trips.id, destinationId: schema.trips.destinationId, preferences: schema.trips.preferences }).from(schema.trips).where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, userId)));
  if (!t) throw new Error("not_found");
  return { ...t, prefs: t.preferences as unknown as TripPreferences };
}

async function loadDayStops(dayId: string, tripId: string) {
  const db = await getDb();
  const [day] = await db.select().from(schema.itineraryDays).where(and(eq(schema.itineraryDays.id, dayId), eq(schema.itineraryDays.tripId, tripId)));
  if (!day) throw new Error("not_found");
  const stops = await db.select().from(schema.itineraryStops).where(eq(schema.itineraryStops.dayId, dayId)).orderBy(asc(schema.itineraryStops.position));
  return { day, stops };
}

function rowToPlanned(s: typeof schema.itineraryStops.$inferSelect): PlannedStop {
  const { intercity: _i, officialUrl: _o, ticketed: _t, logistics: _l, ...v } = toStopView(s);
  return { ...v, id: s.id, details: s.details ?? null };
}

/** The destination a given day is spent in (multi-city days carry their own). */
async function dayDestination(dayId: string, tripId: string, fallback: string | null) {
  const db = await getDb();
  const [d] = await db.select({ destinationId: schema.itineraryDays.destinationId }).from(schema.itineraryDays).where(and(eq(schema.itineraryDays.id, dayId), eq(schema.itineraryDays.tripId, tripId)));
  return d?.destinationId ?? fallback;
}

/** Recomputes times & legs for a day after any edit, then writes positions/times back. */
async function rescheduleAndSave(tripId: string, dayId: string, prefs: TripPreferences, ordered: PlannedStop[], startTime: string) {
  const cleared = ordered.map((s) => ({ ...s, travelSource: null, travelMinutes: null, travelMeters: null, travelMode: null }));
  const scheduled = scheduleDay(await refineLegs(scheduleDay(cleared, startTime, prefs.transport)), startTime, prefs.transport);
  const db = await getDb();
  await db.transaction(async (tx) => {
    const keepIds = scheduled.map((s) => s.id).filter(Boolean) as string[];
    if (keepIds.length) {
      await tx.delete(schema.itineraryStops).where(and(eq(schema.itineraryStops.dayId, dayId), sql`${schema.itineraryStops.id} not in (${sql.join(keepIds.map((id) => sql`${id}::uuid`), sql`, `)})`));
    } else {
      await tx.delete(schema.itineraryStops).where(eq(schema.itineraryStops.dayId, dayId));
    }
    for (let i = 0; i < scheduled.length; i++) {
      const s = scheduled[i];
      const row = stopRow(tripId, dayId, s, i);
      if (s.id) await tx.update(schema.itineraryStops).set(row).where(and(eq(schema.itineraryStops.id, s.id), eq(schema.itineraryStops.tripId, tripId)));
      else await tx.insert(schema.itineraryStops).values(row);
    }
    await tx.update(schema.trips).set({ updatedAt: new Date() }).where(eq(schema.trips.id, tripId));
  });
}

export async function reorderStops(userId: string, tripId: string, dayId: string, orderedIds: string[]) {
  const { prefs } = await assertOwner(tripId, userId);
  const { day, stops } = await loadDayStops(dayId, tripId);
  const byId = new Map(stops.map((s) => [s.id, s]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as (typeof stops)[number][];
  for (const s of stops) if (!orderedIds.includes(s.id)) ordered.push(s); // never drop stops on a malformed request
  // Leaving/returning to the accommodation, check-in and the like stay where they are.
  await rescheduleAndSave(tripId, dayId, prefs, pinLogistics(stops.map(rowToPlanned), ordered.map(rowToPlanned)), day.startTime);
}

/** Moves a stop to another day (appended before dinner if present). */
export async function moveStopToDay(userId: string, tripId: string, stopId: string, toDayId: string) {
  const { prefs } = await assertOwner(tripId, userId);
  const db = await getDb();
  const [stop] = await db.select().from(schema.itineraryStops).where(and(eq(schema.itineraryStops.id, stopId), eq(schema.itineraryStops.tripId, tripId)));
  if (!stop || stop.dayId === toDayId || stop.details?.role || stop.details?.intercity) return;
  const target = await loadDayStops(toDayId, tripId);
  const source = await loadDayStops(stop.dayId, tripId);
  const targetStops = target.stops.map(rowToPlanned);
  const moved = { ...rowToPlanned(stop), id: undefined };
  targetStops.splice(insertionIndex(targetStops), 0, moved);
  await db.delete(schema.itineraryStops).where(eq(schema.itineraryStops.id, stopId));
  await rescheduleAndSave(tripId, toDayId, prefs, targetStops, target.day.startTime);
  await rescheduleAndSave(tripId, source.day.id, prefs, source.stops.filter((s) => s.id !== stopId).map(rowToPlanned), source.day.startTime);
}

export async function removeStop(userId: string, tripId: string, stopId: string) {
  const { prefs } = await assertOwner(tripId, userId);
  const db = await getDb();
  const [stop] = await db.select().from(schema.itineraryStops).where(and(eq(schema.itineraryStops.id, stopId), eq(schema.itineraryStops.tripId, tripId)));
  if (!stop || stop.details?.role) return; // logistics stops are part of the plan's structure
  const { day, stops } = await loadDayStops(stop.dayId, tripId);
  await rescheduleAndSave(tripId, day.id, prefs, stops.filter((s) => s.id !== stopId).map(rowToPlanned), day.startTime);
}

export async function setStopLocked(userId: string, tripId: string, stopId: string, locked: boolean) {
  await assertOwner(tripId, userId);
  const db = await getDb();
  await db.update(schema.itineraryStops).set({ locked }).where(and(eq(schema.itineraryStops.id, stopId), eq(schema.itineraryStops.tripId, tripId)));
}

export async function updateStopDetails(userId: string, tripId: string, stopId: string, patch: { durationMin?: number; description?: string | null }) {
  const { prefs } = await assertOwner(tripId, userId);
  const db = await getDb();
  const [stop] = await db.select().from(schema.itineraryStops).where(and(eq(schema.itineraryStops.id, stopId), eq(schema.itineraryStops.tripId, tripId)));
  if (!stop) return;
  const { day, stops } = await loadDayStops(stop.dayId, tripId);
  const planned = stops.map(rowToPlanned).map((s) =>
    s.id === stopId ? { ...s, durationMin: patch.durationMin ?? s.durationMin, description: patch.description !== undefined ? patch.description : s.description } : s,
  );
  await rescheduleAndSave(tripId, day.id, prefs, planned, day.startTime);
}

export async function addStop(
  userId: string,
  tripId: string,
  dayId: string,
  input: { placeId?: string; custom?: { title: string; lat: number | null; lng: number | null; durationMin: number; address?: string | null } },
) {
  const { prefs, destinationId: tripDestination } = await assertOwner(tripId, userId);
  const { day, stops } = await loadDayStops(dayId, tripId);
  const destinationId = day.destinationId ?? tripDestination;
  let newStop: PlannedStop | null = null;
  if (input.placeId) {
    const db = await getDb();
    const [p] = await db.select().from(schema.places).where(and(eq(schema.places.id, input.placeId), destinationId ? eq(schema.places.destinationId, destinationId) : sql`false`));
    if (!p) throw new Error("not_found");
    const kind = p.kind === "restaurant" ? "meal" : p.kind === "activity" ? "activity" : "attraction";
    newStop = { kind, title: p.name, placeId: p.id, lat: p.lat, lng: p.lng, address: p.address, durationMin: p.durationMin ?? (kind === "meal" ? 75 : 90), linkUrl: p.websiteUrl ?? p.bookingUrl, locked: false };
  } else if (input.custom) {
    newStop = { kind: "custom", title: input.custom.title.slice(0, 140), lat: input.custom.lat, lng: input.custom.lng, address: input.custom.address ?? null, durationMin: input.custom.durationMin, locked: false };
  }
  if (!newStop) return;
  const planned = stops.map(rowToPlanned);
  planned.splice(insertionIndex(planned), 0, newStop);
  await rescheduleAndSave(tripId, dayId, prefs, planned, day.startTime);
}

/** Swaps an attraction for the best unused nearby alternative, or a generic meal for a verified restaurant. */
export async function replaceStop(userId: string, tripId: string, stopId: string) {
  const { prefs, destinationId } = await assertOwner(tripId, userId);
  const db = await getDb();
  const [stop] = await db.select().from(schema.itineraryStops).where(and(eq(schema.itineraryStops.id, stopId), eq(schema.itineraryStops.tripId, tripId)));
  if (!stop || stop.locked) return { replaced: false };
  const places = await getCandidatePlaces(await dayDestination(stop.dayId, tripId, destinationId));
  const usedRows = await db.select({ placeId: schema.itineraryStops.placeId }).from(schema.itineraryStops).where(eq(schema.itineraryStops.tripId, tripId));
  const used = new Set(usedRows.map((r) => r.placeId).filter(Boolean));
  const unused = places.filter((p) => !used.has(p.id));
  if (!unused.length || (stop.kind !== "attraction" && stop.kind !== "activity")) return { replaced: false };
  const origin = stop.lat != null && stop.lng != null ? { lat: stop.lat, lng: stop.lng } : null;
  const ranked = unused
    .map((p) => ({ p, v: scorePlace(p, prefs) - (origin ? Math.hypot(p.lat - origin.lat, p.lng - origin.lng) * 50 : 0) }))
    .sort((a, b) => b.v - a.v);
  const pick = ranked[0].p;
  const { day, stops } = await loadDayStops(stop.dayId, tripId);
  const planned = stops.map(rowToPlanned).map((s) =>
    s.id === stopId
      ? { ...s, kind: (pick.kind === "activity" ? "activity" : "attraction") as PlannedStop["kind"], title: pick.name, placeId: pick.id, lat: pick.lat, lng: pick.lng, durationMin: pick.durationMin ?? 90, description: null, linkUrl: null, costMin: null, costMax: null, costStatus: null }
      : s,
  );
  await rescheduleAndSave(tripId, day.id, prefs, planned, day.startTime);
  return { replaced: true };
}

/** Regenerates one day. Locked stops are kept; places used on other days are excluded. */
export async function regenerateDay(userId: string, tripId: string, dayId: string) {
  const { prefs, destinationId: tripDestination } = await assertOwner(tripId, userId);
  const db = await getDb();
  const { day, stops } = await loadDayStops(dayId, tripId);
  const destinationId = day.destinationId ?? tripDestination;
  const places = await getCandidatePlaces(destinationId);
  const otherRows = await db
    .select({ placeId: schema.itineraryStops.placeId })
    .from(schema.itineraryStops)
    .where(and(eq(schema.itineraryStops.tripId, tripId), ne(schema.itineraryStops.dayId, dayId)));
  const usedElsewhere = new Set(otherRows.map((r) => r.placeId).filter(Boolean));
  const previousIds = new Set(stops.filter((s) => !s.locked).map((s) => s.placeId).filter(Boolean));
  // Prefer places not shown on this day before, so "regenerate" actually changes something.
  const fresh = places.filter((p) => !usedElsewhere.has(p.id) && !previousIds.has(p.id));
  const pool = fresh.length >= 2 ? fresh : places.filter((p) => !usedElsewhere.has(p.id));
  // Intercity journeys are rebuilt from the trip plan, so they are never kept as "locked" duplicates.
  const locked = stops.filter((s) => s.locked && s.kind !== "transport").map(rowToPlanned);

  let planned: PlannedDay;
  const { ctx, centre } = await logisticsFor(prefs, tripDestination);
  const ready = day.dayIndex === 0 && centre ? arrivalReadyMinutes(prefs, ctx.stays[tripDestination ?? ""] ?? null, centre) : null;
  const slot = isMultiCity(prefs) ? layoutDays(prefs.segments!, tripDates(prefs).length)[day.dayIndex] : undefined;
  if (slot && slot.segment.destinationId === destinationId) {
    planned = buildPlan({ prefs, slots: [{ ...slot, index: 0 }], dates: [day.date ?? ""], places: { [slot.segment.slug]: pool }, locked: { 0: locked }, timing: { arrivalReady: ready } })[0];
  } else {
    const scores = new Map(places.map((p, i) => [p.id, scorePlace(p, prefs, (places.length - i) / places.length)]));
    planned = buildDay({
      dayIndex: day.dayIndex,
      date: day.date,
      prefs,
      pool,
      scores,
      lockedStops: locked,
      start: prefs.accommodation?.lat != null && prefs.accommodation?.lng != null ? { lat: prefs.accommodation.lat, lng: prefs.accommodation.lng } : null,
      ...(ready != null ? { startAt: toHHMM(Math.min(ready, 22 * 60)), targetDelta: ready >= 17 * 60 ? -9 : ready >= 14 * 60 ? -2 : ready >= 12 * 60 ? -1 : 0 } : {}),
    }).day;
  }
  // Re-add the day's logistics in the context of the whole trip (first/last day, travel days…).
  const allDays = await db.select().from(schema.itineraryDays).where(eq(schema.itineraryDays.tripId, tripId)).orderBy(asc(schema.itineraryDays.dayIndex));
  const shell: PlannedDay[] = allDays.map((d) => ({ dayIndex: d.dayIndex, date: d.date, title: d.title, startTime: d.startTime, stops: [], destinationId: d.destinationId, kind: d.kind }));
  const at = shell.findIndex((d) => d.dayIndex === day.dayIndex);
  shell[at] = { ...planned, destinationId: day.destinationId, kind: day.kind };
  planned = applyLogisticsAt(shell, at, ctx);
  const refined = scheduleDay(await refineLegs(planned.stops), planned.startTime || dayStartTime(prefs), prefs.transport);
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.itineraryStops)
      .where(and(eq(schema.itineraryStops.dayId, dayId), sql`(${schema.itineraryStops.locked} = false or ${schema.itineraryStops.kind} = 'transport')`));
    // Locked rows keep their ids; update their position/time, insert everything else.
    for (let i = 0; i < refined.length; i++) {
      const s = refined[i];
      const row = stopRow(tripId, dayId, s, i);
      if (s.id) await tx.update(schema.itineraryStops).set(row).where(eq(schema.itineraryStops.id, s.id));
      else await tx.insert(schema.itineraryStops).values(row);
    }
    await tx.update(schema.itineraryDays).set({ title: planned.title.slice(0, 200), startTime: planned.startTime }).where(eq(schema.itineraryDays.id, dayId));
    await tx.update(schema.trips).set({ updatedAt: new Date() }).where(eq(schema.trips.id, tripId));
  });
}

/** Regenerates the whole trip, day by day, preserving locked stops. */
export async function regenerateTrip(userId: string, tripId: string, locale: string) {
  const { prefs, destinationId } = await assertOwner(tripId, userId);
  const db = await getDb();
  const hasLocked = await db.select({ id: schema.itineraryStops.id }).from(schema.itineraryStops).where(and(eq(schema.itineraryStops.tripId, tripId), eq(schema.itineraryStops.locked, true))).limit(1);
  const dayRows = await db.select({ id: schema.itineraryDays.id }).from(schema.itineraryDays).where(eq(schema.itineraryDays.tripId, tripId)).orderBy(asc(schema.itineraryDays.dayIndex));
  if (!hasLocked.length || !dayRows.length) {
    const { days, source } = await generateDays(prefs, destinationId, locale);
    await persistDays(tripId, days);
    await db.update(schema.trips).set({ status: "planned", generationSource: source }).where(eq(schema.trips.id, tripId));
    return;
  }
  // With locked items, regenerate each day individually so nothing locked is touched.
  await db.update(schema.itineraryStops).set({ placeId: sql`case when ${schema.itineraryStops.locked} then ${schema.itineraryStops.placeId} else null end` }).where(eq(schema.itineraryStops.tripId, tripId));
  for (const d of dayRows) await regenerateDay(userId, tripId, d.id);
}

/**
 * Rebuilds the trip after its structure changed (cities accepted/removed, accommodation set).
 * Locked stops are carried over to a day in the same destination — the same day when possible.
 * Locked stops in a destination that is no longer part of the trip are the only ones dropped.
 */
async function restructureTrip(tripId: string, tripDestination: string | null, newPrefs: TripPreferences, locale: string) {
  const db = await getDb();
  const oldDays = await db.select().from(schema.itineraryDays).where(eq(schema.itineraryDays.tripId, tripId)).orderBy(asc(schema.itineraryDays.dayIndex));
  const lockedRows = await db.select().from(schema.itineraryStops).where(and(eq(schema.itineraryStops.tripId, tripId), eq(schema.itineraryStops.locked, true), ne(schema.itineraryStops.kind, "transport")));
  const dates = tripDates(newPrefs);
  const slots = isMultiCity(newPrefs) ? layoutDays(newPrefs.segments!, dates.length) : dates.map((_, i) => ({ index: i, segment: { destinationId: tripDestination }, kind: "normal" as const }));
  const locked: Record<number, PlannedStop[]> = {};
  for (const row of lockedRows) {
    const old = oldDays.find((d) => d.id === row.dayId);
    const dest = old?.destinationId ?? tripDestination;
    const fits = (i: number) => slots[i]?.segment.destinationId === dest && slots[i].kind === "normal";
    const target = old && fits(old.dayIndex) ? old.dayIndex : slots.findIndex((_, i) => fits(i));
    if (target < 0) continue;
    (locked[target] ??= []).push({ ...rowToPlanned(row), id: undefined });
  }
  const { days, source } = isMultiCity(newPrefs)
    ? await generateDays(newPrefs, tripDestination, locale, locked)
    : await generateSingleWithLocked(newPrefs, tripDestination, locale, locked);
  await db.update(schema.trips).set({ preferences: newPrefs as unknown as Record<string, unknown> }).where(eq(schema.trips.id, tripId));
  await persistDays(tripId, days);
  await db.update(schema.trips).set({ status: "planned", generationSource: source }).where(eq(schema.trips.id, tripId));
}

/** Single-destination generation that keeps locked stops on their days. */
async function generateSingleWithLocked(prefs: TripPreferences, destinationId: string | null, locale: string, locked: Record<number, PlannedStop[]>) {
  if (!Object.keys(locked).length) return generateDays(prefs, destinationId, locale);
  const { ctx, centre } = await logisticsFor(prefs, destinationId);
  const ready = centre ? arrivalReadyMinutes(prefs, ctx.stays[destinationId ?? ""] ?? null, centre) : null;
  const places = await getCandidatePlaces(destinationId);
  const lockedIds = new Set(Object.values(locked).flat().map((s) => s.placeId).filter(Boolean));
  const dates = tripDates(prefs);
  const scores = new Map(places.map((p, i) => [p.id, scorePlace(p, prefs, (places.length - i) / places.length)]));
  const start = prefs.accommodation?.lat != null && prefs.accommodation?.lng != null ? { lat: prefs.accommodation.lat, lng: prefs.accommodation.lng } : null;
  let remaining = places.filter((p) => !lockedIds.has(p.id));
  const days: PlannedDay[] = [];
  for (let i = 0; i < dates.length; i++) {
    const arrival = i === 0 && ready != null ? { startAt: toHHMM(Math.min(ready, 22 * 60)), targetDelta: ready >= 17 * 60 ? -9 : ready >= 14 * 60 ? -2 : ready >= 12 * 60 ? -1 : 0 } : {};
    const { day, used } = buildDay({ dayIndex: i, date: dates[i], prefs, pool: remaining, scores, lockedStops: locked[i] ?? [], start, isArrivalDay: i === 0 && dates.length > 1 && Boolean(prefs.departureTime), isDepartureDay: i === dates.length - 1 && dates.length > 1 && Boolean(prefs.returnTime), ...arrival });
    remaining = remaining.filter((p) => !used.includes(p.id));
    days.push(day);
  }
  return { days: await finishDays(days, ctx, prefs), source: "rules" as const };
}

export type SplitChoice = { optionId: string } | { slug: string; type: "stay" | "day_trip" };

/** Accepts a suggested (or self-picked) nearby destination and rebuilds the itinerary around it. */
export async function acceptSplit(userId: string, tripId: string, choice: SplitChoice, locale: string) {
  const { prefs, destinationId } = await assertOwner(tripId, userId);
  const ctx = await getPlanningContext(destinationId, locale);
  if (!ctx) throw new Error("not_found");
  const total = tripDates(prefs).length;
  let option: SplitOption | null | undefined;
  if ("optionId" in choice) {
    // Re-validated server-side: only an option the engine itself would suggest right now.
    option = suggestSplit(ctx.base, total, prefs.pace, ctx.nearby, 10)?.options.find((o) => o.id === choice.optionId);
  } else {
    const n = ctx.nearby.find((x) => x.slug === choice.slug);
    option = n ? customOption(ctx.base, total, n, choice.type) : null;
  }
  if (!option) throw new Error("invalid_option");
  await restructureTrip(tripId, destinationId, { ...prefs, segments: segmentsFor(ctx.base, option), splitDecision: "accepted" }, locale);
}

/** "Keep my plan": hides the suggestion without changing anything. */
export async function declineSplit(userId: string, tripId: string) {
  const { prefs } = await assertOwner(tripId, userId);
  const db = await getDb();
  await db.update(schema.trips).set({ preferences: { ...prefs, splitDecision: "declined" } as unknown as Record<string, unknown>, updatedAt: new Date() }).where(eq(schema.trips.id, tripId));
}

/** Goes back to spending the whole trip at the main destination (the suggestion can be shown again). */
export async function resetSplit(userId: string, tripId: string, locale: string) {
  const { prefs, destinationId } = await assertOwner(tripId, userId);
  if (!isMultiCity(prefs)) return;
  await restructureTrip(tripId, destinationId, { ...prefs, segments: undefined, splitDecision: null }, locale);
}

/** Saves (or clears) the booked accommodation and re-plans days around it. */
export async function setAccommodation(userId: string, tripId: string, acc: TripPreferences["accommodation"], locale: string) {
  const { prefs, destinationId } = await assertOwner(tripId, userId);
  await restructureTrip(tripId, destinationId, { ...prefs, accommodation: { ...prefs.accommodation, ...acc } }, locale);
}

/** Saves (or clears) a booked stay in another city of a multi-city trip, then re-plans. */
export async function setStay(userId: string, tripId: string, slug: string, stay: BookedStay | null, locale: string) {
  const { prefs, destinationId } = await assertOwner(tripId, userId);
  if (!prefs.segments?.some((x) => x.slug === slug)) throw new Error("not_found");
  const stays = { ...(prefs.stays ?? {}) };
  if (stay) stays[slug] = stay;
  else delete stays[slug];
  await restructureTrip(tripId, destinationId, { ...prefs, stays }, locale);
}

export interface LogisticsPatch {
  arrival: TravelEnd | null;
  departure: TravelEnd | null;
  arrivalTime: string | null;
  departureTime: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
}

/** Arrival/departure and check-in/out times, editable after the trip was created. Re-plans the trip. */
export async function setLogistics(userId: string, tripId: string, patch: LogisticsPatch, locale: string) {
  const { prefs, destinationId } = await assertOwner(tripId, userId);
  await restructureTrip(
    tripId,
    destinationId,
    { ...prefs, arrival: patch.arrival, departure: patch.departure, departureTime: patch.arrivalTime, returnTime: patch.departureTime, checkInTime: patch.checkInTime, checkOutTime: patch.checkOutTime },
    locale,
  );
}

export async function duplicateTrip(userId: string, tripId: string, copyLabel: string) {
  const src = await getTrip(tripId, userId);
  if (!src) throw new Error("not_found");
  const db = await getDb();
  // Duplicates are edits of an existing plan, not new plans — they don't consume an allowance.
  const [copy] = await db
    .insert(schema.trips)
    .values({
      userId,
      title: `${src.title} (${copyLabel})`.slice(0, 140),
      mode: src.mode,
      status: "draft",
      destinationId: src.destinationId,
      destinationName: src.destinationName,
      departureCity: src.departureCity,
      startDate: src.startDate,
      endDate: src.endDate,
      adults: src.adults,
      children: src.children,
      budgetTotal: src.budgetTotal != null ? String(src.budgetTotal) : null,
      currency: src.currency,
      preferences: src.preferences as unknown as Record<string, unknown>,
      generationSource: src.generationSource,
      entitlement: "free",
    })
    .returning({ id: schema.trips.id });
  await persistDays(
    copy.id,
    src.days.map((d) => ({
      dayIndex: d.dayIndex,
      date: d.date,
      title: d.title,
      startTime: d.startTime,
      destinationId: d.destinationId === src.destinationId ? null : d.destinationId,
      kind: d.kind,
      stops: d.stops.map(({ intercity, officialUrl: _o, ticketed: _t, logistics, ...s }) => ({ ...s, id: undefined, details: intercity || logistics ? { ...(logistics ?? {}), ...(intercity ? { intercity } : {}) } : null })),
    })),
  );
  return copy.id;
}

export async function deleteTrip(userId: string, tripId: string) {
  const db = await getDb();
  await db.delete(schema.trips).where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, userId)));
}

export async function updateTripMeta(userId: string, tripId: string, patch: { title?: string; status?: "draft" | "planned" | "completed" }) {
  const db = await getDb();
  await db
    .update(schema.trips)
    .set({ ...(patch.title ? { title: patch.title.slice(0, 140) } : {}), ...(patch.status ? { status: patch.status } : {}), updatedAt: new Date() })
    .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, userId)));
}
