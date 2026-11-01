import "server-only";
import { and, asc, desc, eq, inArray, ne, sql, gt, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { MAX_TRIP_DAYS } from "@/config/site";
import { getActiveSubscription, type Entitlement } from "@/lib/entitlements";
import { buildDay, buildItinerary, scheduleDay, scorePlace, dayStartTime } from "@/lib/itinerary/engine";
import { generateWithAI } from "@/lib/itinerary/ai";
import { refineLegs } from "@/lib/itinerary/routing";
import type { CandidatePlace, PlannedDay, PlannedStop, TripPreferences } from "@/lib/itinerary/types";
import { FREE_TRIPS_INCLUDED } from "@/config/site";

export class NeedsPaymentError extends Error {
  constructor() {
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
}

export interface DayView {
  id: string;
  dayIndex: number;
  date: string | null;
  title: string;
  startTime: string;
  notes: string | null;
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
      stops: stops.filter((s) => s.dayId === d.id).map(toStopView),
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
  return rows.map((p) => ({ id: p.id, name: p.name, kind: p.kind, tags: p.tags, durationMin: p.durationMin, neighborhood: p.neighborhood, lat: p.lat, lng: p.lng }));
}

/* ───────────── Creation ───────────── */

/** Atomically claims the right to create one trip. Throws NeedsPaymentError when none is left. */
async function claimEntitlement(userId: string): Promise<Entitlement> {
  const db = await getDb();
  if (await getActiveSubscription(userId)) {
    await db.update(schema.users).set({ tripsCreatedTotal: sql`${schema.users.tripsCreatedTotal} + 1` }).where(eq(schema.users.id, userId));
    return "subscription";
  }
  const free = await db
    .update(schema.users)
    .set({ tripsCreatedTotal: sql`${schema.users.tripsCreatedTotal} + 1` })
    .where(and(eq(schema.users.id, userId), lt(schema.users.tripsCreatedTotal, FREE_TRIPS_INCLUDED)))
    .returning({ id: schema.users.id });
  if (free.length) return "free";
  const credit = await db
    .update(schema.users)
    .set({ tripCredits: sql`${schema.users.tripCredits} - 1`, tripsCreatedTotal: sql`${schema.users.tripsCreatedTotal} + 1` })
    .where(and(eq(schema.users.id, userId), gt(schema.users.tripCredits, 0)))
    .returning({ id: schema.users.id });
  if (credit.length) return "credit";
  throw new NeedsPaymentError();
}

async function generateDays(prefs: TripPreferences, destinationId: string | null, locale: string): Promise<{ days: PlannedDay[]; source: "ai" | "rules" }> {
  const places = await getCandidatePlaces(destinationId);
  const ai = await generateWithAI(prefs, places, MAX_TRIP_DAYS, locale);
  const days = ai ?? buildItinerary(prefs, places, MAX_TRIP_DAYS);
  const refined = await Promise.all(days.map(async (d) => ({ ...d, stops: scheduleDay(await refineLegs(d.stops), d.startTime, prefs.transport) })));
  return { days: refined, source: ai ? "ai" : "rules" };
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
  };
}

async function persistDays(tripId: string, days: PlannedDay[]) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.itineraryDays).where(eq(schema.itineraryDays.tripId, tripId));
    for (const d of days) {
      const [day] = await tx
        .insert(schema.itineraryDays)
        .values({ tripId, dayIndex: d.dayIndex, date: d.date, title: d.title.slice(0, 200), startTime: d.startTime })
        .returning({ id: schema.itineraryDays.id });
      if (d.stops.length) await tx.insert(schema.itineraryStops).values(d.stops.map((s, i) => stopRow(tripId, day.id, s, i)));
    }
    await tx.update(schema.trips).set({ updatedAt: new Date() }).where(eq(schema.trips.id, tripId));
  });
}

export async function createTrip(opts: { userId: string; mode: "fast" | "detailed"; prefs: TripPreferences; destinationId: string | null; title: string; locale: string; participants?: { name: string; isChild: boolean }[] }) {
  const entitlement = await claimEntitlement(opts.userId);
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
  const v = toStopView(s);
  return { ...v, id: s.id };
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
  await rescheduleAndSave(tripId, dayId, prefs, ordered.map(rowToPlanned), day.startTime);
}

/** Moves a stop to another day (appended before dinner if present). */
export async function moveStopToDay(userId: string, tripId: string, stopId: string, toDayId: string) {
  const { prefs } = await assertOwner(tripId, userId);
  const db = await getDb();
  const [stop] = await db.select().from(schema.itineraryStops).where(and(eq(schema.itineraryStops.id, stopId), eq(schema.itineraryStops.tripId, tripId)));
  if (!stop || stop.dayId === toDayId) return;
  const target = await loadDayStops(toDayId, tripId);
  const source = await loadDayStops(stop.dayId, tripId);
  const targetStops = target.stops.map(rowToPlanned);
  const dinnerIdx = targetStops.findIndex((s) => s.mealType === "dinner");
  const moved = { ...rowToPlanned(stop), id: undefined };
  targetStops.splice(dinnerIdx >= 0 ? dinnerIdx : targetStops.length, 0, moved);
  await db.delete(schema.itineraryStops).where(eq(schema.itineraryStops.id, stopId));
  await rescheduleAndSave(tripId, toDayId, prefs, targetStops, target.day.startTime);
  await rescheduleAndSave(tripId, source.day.id, prefs, source.stops.filter((s) => s.id !== stopId).map(rowToPlanned), source.day.startTime);
}

export async function removeStop(userId: string, tripId: string, stopId: string) {
  const { prefs } = await assertOwner(tripId, userId);
  const db = await getDb();
  const [stop] = await db.select().from(schema.itineraryStops).where(and(eq(schema.itineraryStops.id, stopId), eq(schema.itineraryStops.tripId, tripId)));
  if (!stop) return;
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
  const { prefs, destinationId } = await assertOwner(tripId, userId);
  const { day, stops } = await loadDayStops(dayId, tripId);
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
  const dinnerIdx = planned.findIndex((s) => s.mealType === "dinner");
  planned.splice(dinnerIdx >= 0 ? dinnerIdx : planned.length, 0, newStop);
  await rescheduleAndSave(tripId, dayId, prefs, planned, day.startTime);
}

/** Swaps an attraction for the best unused nearby alternative, or a generic meal for a verified restaurant. */
export async function replaceStop(userId: string, tripId: string, stopId: string) {
  const { prefs, destinationId } = await assertOwner(tripId, userId);
  const db = await getDb();
  const [stop] = await db.select().from(schema.itineraryStops).where(and(eq(schema.itineraryStops.id, stopId), eq(schema.itineraryStops.tripId, tripId)));
  if (!stop || stop.locked) return { replaced: false };
  const places = await getCandidatePlaces(destinationId);
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
  const { prefs, destinationId } = await assertOwner(tripId, userId);
  const db = await getDb();
  const { day, stops } = await loadDayStops(dayId, tripId);
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
  const scores = new Map(places.map((p, i) => [p.id, scorePlace(p, prefs, (places.length - i) / places.length)]));
  const locked = stops.filter((s) => s.locked).map(rowToPlanned);
  const { day: planned } = buildDay({
    dayIndex: day.dayIndex,
    date: day.date,
    prefs,
    pool,
    scores,
    lockedStops: locked,
    start: prefs.accommodation?.lat != null && prefs.accommodation?.lng != null ? { lat: prefs.accommodation.lat, lng: prefs.accommodation.lng } : null,
  });
  const refined = scheduleDay(await refineLegs(planned.stops), day.startTime || dayStartTime(prefs), prefs.transport);
  await db.transaction(async (tx) => {
    await tx.delete(schema.itineraryStops).where(and(eq(schema.itineraryStops.dayId, dayId), eq(schema.itineraryStops.locked, false)));
    // Locked rows keep their ids; update their position/time, insert everything else.
    for (let i = 0; i < refined.length; i++) {
      const s = refined[i];
      const row = stopRow(tripId, dayId, s, i);
      if (s.id) await tx.update(schema.itineraryStops).set(row).where(eq(schema.itineraryStops.id, s.id));
      else await tx.insert(schema.itineraryStops).values(row);
    }
    await tx.update(schema.itineraryDays).set({ title: planned.title.slice(0, 200) }).where(eq(schema.itineraryDays.id, dayId));
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
    src.days.map((d) => ({ dayIndex: d.dayIndex, date: d.date, title: d.title, startTime: d.startTime, stops: d.stops.map((s) => ({ ...s, id: undefined })) })),
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
