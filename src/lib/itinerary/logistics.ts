/**
 * Travel logistics around the sights — pure and deterministic (unit-tested).
 *
 *  • every day starts and ends at the accommodation (when its location is known), with the time
 *    and distance of the first and last legs;
 *  • the first day starts at the arrival airport/station, with verified airport transfers when we
 *    have them (src/data/airport-transfers.ts) and live Google Maps directions otherwise;
 *  • check-in / check-out at the accommodation's times, with luggage storage when there's time to
 *    sightsee before check-in or after check-out — on arrival, departure and travel days;
 *  • journeys between cities go accommodation → departure station → train → arrival station.
 *
 * Nothing here invents a venue: luggage storage is a live map search plus "ask your accommodation",
 * stations come from Wikidata, transfer times from the operators' own pages.
 */
import { findAirport, type AirportInfo, type AirportTransferOption } from "@/data/airport-transfers";
import { chooseMode, estimateLeg, googleMapsDirectionsUrl, haversineMeters, type LatLng, type TravelMode } from "@/lib/geo";
import { scheduleDay, toHHMM, toMinutes } from "./engine";
import type { BookedStay, LogisticsRole, PlannedDay, PlannedStop, StopDetails, TransferOptionView, TravelEnd, TripPreferences } from "./types";

import { DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT } from "./logistics-defaults";
export { DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT };
/** Time from landing / pulling in to being outside with your bags. */
export const EXIT_BUFFER_MIN: Record<TravelEnd["mode"], number> = { plane: 30, train: 10, bus: 10, car: 0, other: 0 };
/** How early to be at the airport/station before departure. Flights: a common 2 h rule — the UI says to check with the airline. */
export const DEPARTURE_BUFFER_MIN: Record<TravelEnd["mode"], number> = { plane: 120, train: 15, bus: 15, car: 0, other: 0 };
/** Sightseeing before check-in / after check-out only makes sense with this much time. */
const MIN_LUGGAGE_WINDOW = 90;

const LOGISTIC_MODES: Record<AirportTransferOption["mode"], TravelMode> = { train: "transit", metro: "transit", tram: "transit", bus: "transit", boat: "transit" };

export interface StayPoint {
  name: string | null;
  lat: number | null;
  lng: number | null;
  booked: boolean;
}

export interface Station extends LatLng {
  name: string;
}

export interface LogisticsContext {
  prefs: TripPreferences;
  /** Where the traveller sleeps, by destination id (the base destination's id → the main accommodation). */
  stays: Record<string, StayPoint>;
  /** Main railway station per destination id (when imported). */
  stations: Record<string, Station | undefined>;
  baseDestinationId: string | null;
  /** Luggage-storage places added by editors, per destination id. */
  luggage?: Record<string, { name: string; lat: number; lng: number; url: string | null }[]>;
}

const hasCoords = (p: { lat?: number | null; lng?: number | null } | null | undefined): p is { lat: number; lng: number } => p?.lat != null && p?.lng != null;

export function luggageSearchUrl(p: LatLng): string {
  return `https://www.google.com/maps/search/luggage+storage/@${p.lat.toFixed(5)},${p.lng.toFixed(5)},16z`;
}

/** The stays map for a trip: the main accommodation plus any booked stays in other cities. */
export function staysFor(prefs: TripPreferences, baseDestinationId: string | null): Record<string, StayPoint> {
  const out: Record<string, StayPoint> = {};
  const acc = prefs.accommodation;
  if (baseDestinationId) {
    const booked = acc?.status === "booked" && Boolean(acc.name);
    out[baseDestinationId] = { name: booked ? acc.name ?? null : null, lat: booked && hasCoords(acc) ? acc.lat! : null, lng: booked && hasCoords(acc) ? acc.lng! : null, booked };
  }
  for (const seg of prefs.segments ?? []) {
    if (seg.destinationId === baseDestinationId) continue;
    const s: BookedStay | undefined = prefs.stays?.[seg.slug];
    out[seg.destinationId] = s?.name ? { name: s.name, lat: hasCoords(s) ? s.lat! : null, lng: hasCoords(s) ? s.lng! : null, booked: true } : { name: null, lat: null, lng: null, booked: false };
  }
  return out;
}

/** The arrival (or departure) point: a curated airport when the picked place matches one. */
function resolveEnd(end: TravelEnd | null | undefined): { end: TravelEnd; airport: AirportInfo | null } | null {
  if (!end) return null;
  const airport = end.mode === "plane" ? findAirport(hasCoords(end) ? end : null) : null;
  return { end, airport };
}

/** Best verified transfer for a stay: the option whose drop-off is nearest the accommodation. */
export function pickTransfer(airport: AirportInfo | null, stay: StayPoint | null): AirportTransferOption | null {
  if (!airport?.options.length) return null;
  if (!hasCoords(stay)) return airport.options[0];
  return [...airport.options].sort((a, b) => haversineMeters(a.to, stay) - haversineMeters(b.to, stay) || a.minutes[1] - b.minutes[1])[0];
}

const typical = (o: AirportTransferOption) => Math.round((o.minutes[0] + o.minutes[1]) / 2);
const transferViews = (a: AirportInfo | null): TransferOptionView[] | null =>
  a ? a.options.map((o) => ({ mode: o.mode, service: o.service, to: o.to.name, minutes: o.minutes, url: o.url })) : null;

function legMinutes(a: LatLng, b: LatLng, transport: TripPreferences["transport"]): number {
  return estimateLeg(a, b, chooseMode(transport, haversineMeters(a, b))).minutes;
}

/**
 * When the traveller is free in the city on arrival day (minutes after midnight), or null when no
 * arrival time was given. Used by the engine to size the first day.
 */
export function arrivalReadyMinutes(prefs: TripPreferences, stay: StayPoint | null, cityCentre: LatLng): number | null {
  if (!prefs.departureTime) return null;
  const at = toMinutes(prefs.departureTime);
  const r = resolveEnd(prefs.arrival);
  if (!r || !hasCoords(r.end)) return at + (r ? EXIT_BUFFER_MIN[r.end.mode] : 0);
  const target = hasCoords(stay) ? stay : cityCentre;
  const t = pickTransfer(r.airport, stay);
  const toPoint = t ? typical(t) + legMinutes(t.to, target, prefs.transport) : estimateLeg(r.end as LatLng, target, "transit").minutes;
  return at + EXIT_BUFFER_MIN[r.end.mode] + toPoint;
}

/** Latest time to leave the city for the departure (minutes after midnight), or null. */
export function departureLeaveByMinutes(prefs: TripPreferences, stay: StayPoint | null, cityCentre: LatLng): number | null {
  if (!prefs.returnTime) return null;
  const at = toMinutes(prefs.returnTime);
  const r = resolveEnd(prefs.departure ?? prefs.arrival);
  if (!r || !hasCoords(r.end)) return at - (r ? DEPARTURE_BUFFER_MIN[r.end.mode] : 0);
  const from = hasCoords(stay) ? stay : cityCentre;
  const t = pickTransfer(r.airport, stay);
  const fromPoint = t ? typical(t) + legMinutes(from, t.to, prefs.transport) : estimateLeg(from, r.end as LatLng, "transit").minutes;
  return at - DEPARTURE_BUFFER_MIN[r.end.mode] - fromPoint;
}

/* ───────────── stop builders ───────────── */

function roleStop(role: LogisticsRole, kind: PlannedStop["kind"], title: string, at: { lat: number | null; lng: number | null } | null, durationMin: number, details: Omit<StopDetails, "role"> = {}): PlannedStop {
  return { kind, title, lat: at?.lat ?? null, lng: at?.lng ?? null, durationMin, locked: false, details: { role, ...details } };
}

const stayStop = (role: LogisticsRole, stay: StayPoint, durationMin: number, details: Omit<StopDetails, "role"> = {}) =>
  roleStop(role, "accommodation", stay.name ?? "", hasCoords(stay) ? stay : null, durationMin, { booked: stay.booked, ...details });

const isRole = (s: PlannedStop) => Boolean(s.details?.role);
const isSight = (s: PlannedStop) => s.kind === "attraction" || s.kind === "activity" || s.kind === "custom";
const isRemovable = (s: PlannedStop) => !isRole(s) && !s.locked && !s.details?.intercity && s.mealType !== "breakfast";

/** Inserts check-in (and bag collection) at the first point of the day at or after check-in time. */
function insertCheckIn(stops: PlannedStop[], startTime: string, prefs: TripPreferences, checkIn: PlannedStop[], afterIndex: number): PlannedStop[] {
  const scheduled = scheduleDay(stops, startTime, prefs.transport);
  const ci = toMinutes(prefs.checkInTime || DEFAULT_CHECK_IN);
  let k = scheduled.findIndex((s, i) => i > afterIndex && (toMinutes(s.startTime!) >= ci - 20 || s.mealType === "dinner" || s.mealType === "drinks" || s.details?.role === "day_end"));
  if (k < 0) k = stops.length;
  return [...stops.slice(0, k), ...checkIn, ...stops.slice(k)];
}

/** Check-out days start early enough to leave by the check-out time (breakfast comes after). */
function checkOutStart(startTime: string, prefs: TripPreferences): string {
  const co = toMinutes(prefs.checkOutTime || DEFAULT_CHECK_OUT);
  return toHHMM(Math.min(toMinutes(startTime), co - 15));
}

/* ───────────── per-day assembly ───────────── */

/** Removes logistics stops so the pass can run again on an existing plan. */
export function stripLogistics(stops: PlannedStop[]): PlannedStop[] {
  return stops.filter((s) => !isRole(s));
}

export function applyLogistics(days: PlannedDay[], ctx: LogisticsContext): PlannedDay[] {
  return days.map((d, i) => withStorage(applyDayLogistics(d, i, days, ctx), i, days, ctx));
}

/** Logistics for one day of an existing trip (used when a single day is regenerated). */
export function applyLogisticsAt(days: PlannedDay[], i: number, ctx: LogisticsContext): PlannedDay {
  return withStorage(applyDayLogistics(days[i], i, days, ctx), i, days, ctx);
}

/** Where new stops go: before dinner, or before the day's closing logistics (return, bags, departure). */
export function insertionIndex(stops: PlannedStop[]): number {
  const closing = new Set<LogisticsRole>(["day_end", "luggage_pickup", "departure_point", "departure"]);
  const idx = stops.findIndex((s) => s.mealType === "dinner" || (s.details?.role != null && closing.has(s.details.role)));
  return idx >= 0 ? idx : stops.length;
}

/** Names an editor-added luggage storage within ~1.2 km of each "leave your bags" stop. */
function withStorage(day: PlannedDay, i: number, days: PlannedDay[], ctx: LogisticsContext): PlannedDay {
  const pools = [day.destinationId, sleepDestination(i, days, ctx)].filter(Boolean).flatMap((id) => ctx.luggage?.[id!] ?? []);
  if (!pools.length) return day;
  return {
    ...day,
    stops: day.stops.map((s) => {
      if (s.details?.role !== "luggage_drop" || !hasCoords(s)) return s;
      const near = pools.map((p) => ({ p, d: haversineMeters(p, s as LatLng) })).filter((x) => x.d <= 1200).sort((a, b) => a.d - b.d)[0];
      return near ? { ...s, details: { ...s.details, storage: { name: near.p.name, url: near.p.url, meters: Math.round(near.d) } } } : s;
    }),
  };
}

/** Where the traveller sleeps on day i (day trips sleep at the previous base). */
function sleepDestination(i: number, days: PlannedDay[], ctx: LogisticsContext): string | null {
  for (let j = i; j >= 0; j--) if (days[j].kind !== "day_trip" && days[j].destinationId) return days[j].destinationId!;
  for (let j = i + 1; j < days.length; j++) if (days[j].kind !== "day_trip" && days[j].destinationId) return days[j].destinationId!;
  return ctx.baseDestinationId;
}

export function applyDayLogistics(day: PlannedDay, i: number, days: PlannedDay[], ctx: LogisticsContext): PlannedDay {
  const { prefs } = ctx;
  const n = days.length;
  const isFirst = i === 0;
  const isLast = i === n - 1 && n > 1;
  const stops = stripLogistics(day.stops);
  const sleepId = (day.kind === "travel" ? day.destinationId : sleepDestination(i, days, ctx)) ?? ctx.baseDestinationId;
  const stay: StayPoint = (sleepId && ctx.stays[sleepId]) || { name: null, lat: null, lng: null, booked: false };
  let startTime = day.startTime;
  let out: PlannedStop[] = stops;

  // Journeys between cities: from the real departure station to the real arrival station.
  const jIdx = out.findIndex((s) => s.details?.intercity);
  if (jIdx >= 0) {
    out = out.map((s) => ({ ...s }));
    const j = out[jIdx];
    const info = { ...j.details!.intercity! };
    const fromId = day.kind === "travel" ? sleepDestination(Math.max(0, i - 1), days, ctx) : sleepId;
    const toId = day.kind === "travel" ? day.destinationId : day.destinationId;
    const fromSt = info.mode === "train" && fromId ? ctx.stations[fromId] : undefined;
    const toSt = info.mode === "train" && toId ? ctx.stations[toId] : undefined;
    if (fromSt) {
      info.fromStation = fromSt.name;
      j.lat = fromSt.lat;
      j.lng = fromSt.lng;
    }
    if (toSt) info.toStation = toSt.name;
    // Allow 15 minutes at the station before departure.
    j.durationMin = info.minutes + (fromSt ? 15 : 0);
    // Out of the journey: 0 when the arrival station follows; otherwise the usual transfer estimate
    // (the stop now sits at the departure station, so a straight-line leg would be meaningless).
    const outLeg = toSt ? 0 : fromSt ? (info.mode === "car" ? 10 : 25) : null;
    j.details = { ...j.details, intercity: info, ...(outLeg != null ? { fixedLeg: { minutes: outLeg, mode: (info.mode === "car" ? "driving" : "transit") as TravelMode } } : {}) };
    if (toSt) out.splice(jIdx + 1, 0, roleStop("station_arrival", "transport", toSt.name, toSt, 0));
    // Day trips come back the same way.
    const backIdx = out.findIndex((s, k) => k > jIdx && s.details?.intercity?.direction === "back");
    if (backIdx >= 0) {
      const b = out[backIdx];
      const binfo = { ...b.details!.intercity! };
      if (toSt) {
        binfo.fromStation = toSt.name;
        b.lat = toSt.lat;
        b.lng = toSt.lng;
      }
      if (fromSt) binfo.toStation = fromSt.name;
      b.durationMin = binfo.minutes + (toSt ? 15 : 0);
      const backLeg = fromSt ? 0 : toSt ? (binfo.mode === "car" ? 10 : 25) : null;
      b.details = { ...b.details, intercity: binfo, ...(backLeg != null ? { fixedLeg: { minutes: backLeg, mode: (binfo.mode === "car" ? "driving" : "transit") as TravelMode } } : {}) };
      if (fromSt) out.splice(backIdx + 1, 0, roleStop("station_arrival", "transport", fromSt.name, fromSt, 0));
    }
  }

  if (isFirst) {
    // ── Arrival day ──
    const head: PlannedStop[] = [];
    const r = resolveEnd(prefs.arrival);
    const arrivalAt = prefs.departureTime ?? null;
    let readyPoint: LatLng | null = null;
    if (r && hasCoords(r.end) && arrivalAt) {
      const t = pickTransfer(r.airport, stay);
      const target = hasCoords(stay) ? stay : t?.to ?? null;
      head.push(
        roleStop("arrival", "transport", r.end.name ?? "", r.end as LatLng, EXIT_BUFFER_MIN[r.end.mode], {
          notBefore: arrivalAt,
          at: arrivalAt,
          travelMode: r.end.mode,
          transfers: transferViews(r.airport),
          directionsUrl: target ? googleMapsDirectionsUrl([r.end as LatLng, target], "transit") : null,
          fixedLeg: t ? { minutes: typical(t), mode: LOGISTIC_MODES[t.mode], label: t.service } : null,
        }),
      );
      if (t) head.push(roleStop("arrival_point", "transport", t.to.name, t.to, 0, { luggageUrl: luggageSearchUrl(t.to) }));
      readyPoint = t ? t.to : (r.end as LatLng);
      startTime = arrivalAt;
    } else if (arrivalAt) {
      startTime = arrivalAt;
    }
    const sights = out.filter(isSight).length;
    if (arrivalAt) {
      // Bags: straight to check-in when it's (nearly) time; otherwise store them and sightsee first.
      const firstStops = [...head];
      const scheduledHead = scheduleDay([...head, stayStop("check_in", stay, 0)], startTime, prefs.transport);
      const atStay = toMinutes(scheduledHead[scheduledHead.length - 1].startTime!);
      const ci = toMinutes(prefs.checkInTime || DEFAULT_CHECK_IN);
      if (ci - atStay >= MIN_LUGGAGE_WINDOW && sights > 0) {
        // Store bags at (or near) the accommodation when we know where it is, otherwise near the arrival station.
        const storeAt: LatLng | null = hasCoords(stay) ? stay : readyPoint;
        const drop = hasCoords(stay)
          ? stayStop("luggage_drop", stay, 10, { luggageUrl: luggageSearchUrl(stay) })
          : roleStop("luggage_drop", "accommodation", head[head.length - 1]?.title ?? "", storeAt, 10, { luggageUrl: storeAt ? luggageSearchUrl(storeAt) : null });
        firstStops.push(drop);
        const collect = hasCoords(stay) ? [] : [roleStop("luggage_pickup", "accommodation", drop.title, storeAt, 10)];
        const checkIn = stayStop("check_in", stay, 15, { notBefore: prefs.checkInTime || DEFAULT_CHECK_IN, at: prefs.checkInTime || DEFAULT_CHECK_IN });
        out = insertCheckIn([...firstStops, ...out], startTime, prefs, [...collect, checkIn], firstStops.length - 1);
      } else {
        firstStops.push(stayStop("check_in", stay, 20, { notBefore: prefs.checkInTime || DEFAULT_CHECK_IN, at: prefs.checkInTime || DEFAULT_CHECK_IN }));
        // If check-in is still far off and there's nothing to see, the wait is shown honestly by the times.
        out = [...firstStops, ...out];
      }
    } else if (hasCoords(stay)) {
      out = [stayStop("day_start", stay, 0), ...out];
    }
  } else if (day.kind === "travel") {
    // ── Moving to the next city: check out, travel, store bags if early, check in ──
    const fromId = sleepDestination(Math.max(0, i - 1), days, ctx);
    const fromStay: StayPoint = (fromId && ctx.stays[fromId]) || { name: null, lat: null, lng: null, booked: false };
    out = [stayStop("check_out", fromStay, 15, { at: prefs.checkOutTime || DEFAULT_CHECK_OUT }), ...out];
    startTime = checkOutStart(startTime, prefs);
    const arrIdx = out.findIndex((s) => s.details?.role === "station_arrival");
    const afterJourney = arrIdx >= 0 ? arrIdx : out.findIndex((s) => s.details?.intercity);
    const scheduled = scheduleDay(out, startTime, prefs.transport);
    const freeAt = toMinutes(scheduled[afterJourney]?.startTime ?? startTime) + (scheduled[afterJourney]?.durationMin ?? 0);
    const ci = toMinutes(prefs.checkInTime || DEFAULT_CHECK_IN);
    const sightsAfter = out.slice(afterJourney + 1).filter(isSight).length;
    const station = arrIdx >= 0 ? out[arrIdx] : null;
    if (ci - freeAt >= MIN_LUGGAGE_WINDOW && sightsAfter > 0) {
      const storeAt: LatLng | null = hasCoords(stay) ? stay : station && hasCoords(station) ? station : null;
      const drop = hasCoords(stay)
        ? stayStop("luggage_drop", stay, 10, { luggageUrl: luggageSearchUrl(stay) })
        : roleStop("luggage_drop", "accommodation", station?.title ?? "", storeAt, 10, { luggageUrl: storeAt ? luggageSearchUrl(storeAt) : null });
      out.splice(afterJourney + 1, 0, drop);
      const collect = hasCoords(stay) ? [] : [roleStop("luggage_pickup", "accommodation", drop.title, storeAt, 10)];
      out = insertCheckIn(out, startTime, prefs, [...collect, stayStop("check_in", stay, 15, { notBefore: prefs.checkInTime || DEFAULT_CHECK_IN, at: prefs.checkInTime || DEFAULT_CHECK_IN })], afterJourney + 1);
    } else {
      out.splice(afterJourney + 1, 0, stayStop("check_in", stay, 20, { notBefore: prefs.checkInTime || DEFAULT_CHECK_IN, at: prefs.checkInTime || DEFAULT_CHECK_IN }));
    }
  } else if (!isLast && hasCoords(stay)) {
    out = [stayStop("day_start", stay, 0), ...out];
  }

  if (isLast) {
    // ── Departure day: check out, maybe store bags and sightsee, then leave in time ──
    // Check out first (by the check-out time), then breakfast near the first sight.
    out = [stayStop("check_out", stay, 15, { at: prefs.checkOutTime || DEFAULT_CHECK_OUT }), ...out];
    startTime = checkOutStart(startTime, prefs);
    const r = resolveEnd(prefs.departure ?? prefs.arrival);
    const leaveAt = prefs.returnTime ?? null;
    const tail: PlannedStop[] = [];
    if (r && hasCoords(r.end) && leaveAt) {
      const t = pickTransfer(r.airport, stay);
      const deadline = toHHMM(toMinutes(leaveAt) - DEPARTURE_BUFFER_MIN[r.end.mode]);
      const from = hasCoords(stay) ? stay : t?.to ?? null;
      if (t) tail.push(roleStop("departure_point", "transport", t.to.name, t.to, 0, { fixedLeg: { minutes: typical(t), mode: LOGISTIC_MODES[t.mode], label: t.service } }));
      tail.push(
        roleStop("departure", "transport", r.end.name ?? "", r.end as LatLng, 0, {
          at: leaveAt,
          deadline,
          travelMode: r.end.mode,
          transfers: transferViews(r.airport),
          directionsUrl: from ? googleMapsDirectionsUrl([from, r.end as LatLng], "transit") : null,
        }),
      );
    }
    // Drop dinner/drinks/free time that the departure makes impossible, then sights from the end until it fits.
    const checkoutIdx = out.findIndex((s) => s.details?.role === "check_out");
    const deadlineOf = () => (tail.length ? tail[tail.length - 1].details!.deadline! : leaveAt ? toHHMM(toMinutes(leaveAt) - 30) : null);
    const fits = (list: PlannedStop[]) => {
      const d = deadlineOf();
      if (!d) return true;
      const sch = scheduleDay(list, startTime, prefs.transport);
      const last = sch[sch.length - 1];
      return toMinutes(last.startTime!) <= toMinutes(d);
    };
    const withBags = (list: PlannedStop[]) => {
      const sightsLeft = list.slice(checkoutIdx + 1).some(isSight);
      if (!sightsLeft) return [...list, ...tail];
      // Sightseeing after check-out: leave bags with the accommodation (or nearby storage) and collect them before leaving.
      const drop = hasCoords(stay) ? stayStop("luggage_drop", stay, 10, { luggageUrl: luggageSearchUrl(stay), at: prefs.checkOutTime || DEFAULT_CHECK_OUT }) : roleStop("luggage_drop", "accommodation", "", null, 10, {});
      const pickup = hasCoords(stay) ? stayStop("luggage_pickup", stay, 10) : roleStop("luggage_pickup", "accommodation", "", null, 10, {});
      return [...list.slice(0, checkoutIdx + 1), drop, ...list.slice(checkoutIdx + 1), pickup, ...tail];
    };
    if (leaveAt) {
      let body = out.filter((s) => !(s.kind === "break" && !s.mealType));
      let candidate = withBags(body);
      while (!fits(candidate)) {
        const idx = [...body].reverse().findIndex(isRemovable);
        if (idx < 0) break;
        body = body.filter((_, k) => k !== body.length - 1 - idx);
        candidate = withBags(body);
      }
      out = candidate;
    } else {
      out = withBags(out);
    }
  } else if (hasCoords(stay)) {
    // Every other day ends back at the accommodation.
    out = [...out, stayStop("day_end", stay, 0)];
  }

  return { ...day, startTime, stops: scheduleDay(out, startTime, prefs.transport) };
}

/**
 * Keeps logistics stops where they were when the traveller reorders the other stops: anything with
 * a role stays at its index, everything else fills the remaining slots in the new order.
 */
export function pinLogistics(before: PlannedStop[], reordered: PlannedStop[]): PlannedStop[] {
  const slots = before.map((s) => (isRole(s) ? s : null));
  const movable = reordered.filter((s) => !isRole(s));
  const out: PlannedStop[] = [];
  let m = 0;
  for (const slot of slots) out.push(slot ?? movable[m++]);
  while (m < movable.length) out.push(movable[m++]);
  return out.filter(Boolean);
}

