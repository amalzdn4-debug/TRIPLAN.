import { describe, it, expect } from "vitest";
import { buildItinerary, buildPlan, toMinutes } from "@/lib/itinerary/engine";
import { applyLogistics, arrivalReadyMinutes, pinLogistics, staysFor, insertionIndex, departureLeaveByMinutes, type LogisticsContext } from "@/lib/itinerary/logistics";
import { findAirport, AIRPORTS } from "@/data/airport-transfers";
import type { CandidatePlace, PlannedStop, TripPreferences } from "@/lib/itinerary/types";
import type { TripSegment } from "@/lib/itinerary/split";
import { samplePrefs } from "./fixtures";

/** Synthetic places around central Milan (not real venues). */
function milanPlaces(n = 12): CandidatePlace[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m-${i}`,
    name: `Sight ${i + 1}`,
    kind: "attraction",
    tags: i % 3 === 0 ? ["museums"] : ["architecture"],
    durationMin: 90,
    neighborhood: i < n / 2 ? "Centro" : "Brera",
    lat: 45.464 + (i % 4) * 0.004,
    lng: 9.19 + Math.floor(i / 4) * 0.004,
  }));
}

const MILAN = "dest-milan";
const centre = { lat: 45.4642, lng: 9.19 };
// A booked flat in the north-east of the city (≈ Via Noale) — coordinates as the address search returns them.
const flat = { status: "booked" as const, name: "Flat Via Noale 7", address: "Via Noale 7, Milano", lat: 45.5065, lng: 9.2235 };
const malpensa = { mode: "plane" as const, name: "Aeroporto di Milano-Malpensa", lat: 45.6301, lng: 8.7255 };

function prefs(over: Partial<TripPreferences> = {}): TripPreferences {
  return samplePrefs({ destinationName: "Milan", startDate: "2027-05-10", endDate: "2027-05-12", accommodation: flat, departureTime: "09:30", returnTime: "18:00", arrival: malpensa, departure: malpensa, checkInTime: "16:00", checkOutTime: "10:00", transport: "public", ...over });
}

function plan(p: TripPreferences, stations: LogisticsContext["stations"] = {}) {
  const ctx: LogisticsContext = { prefs: p, stays: staysFor(p, MILAN), stations, baseDestinationId: MILAN };
  const ready = arrivalReadyMinutes(p, ctx.stays[MILAN], centre);
  return applyLogistics(buildItinerary(p, milanPlaces(), 30, { arrivalReady: ready }), ctx);
}

const role = (s: PlannedStop) => s.details?.role ?? null;
const roles = (stops: PlannedStop[]) => stops.map(role).filter(Boolean);

describe("verified airport data", () => {
  it("matches a picked airport to its curated entry", () => {
    expect(findAirport(malpensa)?.iata).toBe("MXP");
    expect(findAirport({ lat: 45.0, lng: 9.0 })).toBeNull();
  });
  it("every option links to an https page and has a sane time range", () => {
    for (const a of AIRPORTS) for (const o of a.options) {
      expect(o.url.startsWith("https://")).toBe(true);
      expect(o.minutes[0]).toBeGreaterThan(0);
      expect(o.minutes[1]).toBeGreaterThanOrEqual(o.minutes[0]);
    }
  });
});

describe("arrival day (Malpensa 09:30, check-in 16:00)", () => {
  const days = plan(prefs());
  const d0 = days[0].stops;
  it("starts at the airport at the landing time, then the Malpensa Express to Centrale", () => {
    expect(role(d0[0])).toBe("arrival");
    expect(d0[0].startTime).toBe("09:30");
    expect(d0[0].details?.transfers?.some((t) => t.service === "Malpensa Express")).toBe(true);
    expect(role(d0[1])).toBe("arrival_point");
    expect(d0[1].title).toBe("Milano Centrale");
    expect(d0[0].travelMinutes).toBeGreaterThanOrEqual(51);
  });
  it("leaves the bags at the accommodation, sightsees, then checks in at 16:00 or later", () => {
    expect(role(d0[2])).toBe("luggage_drop");
    expect(d0[2].lat).toBe(flat.lat);
    expect(d0[2].details?.luggageUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/luggage\+storage\//);
    const ci = d0.find((s) => role(s) === "check_in")!;
    expect(toMinutes(ci.startTime!)).toBeGreaterThanOrEqual(16 * 60);
    const before = d0.slice(0, d0.indexOf(ci)).filter((s) => s.kind === "attraction");
    expect(before.length).toBeGreaterThan(0);
  });
  it("ends back at the accommodation with a timed leg", () => {
    const last = d0[d0.length - 1];
    expect(role(last)).toBe("day_end");
    expect(d0[d0.length - 2].travelMinutes).not.toBeNull();
  });
});

describe("middle day", () => {
  const d1 = plan(prefs())[1].stops;
  it("starts and ends at the accommodation, with time and distance to the first stop", () => {
    expect(role(d1[0])).toBe("day_start");
    expect(role(d1[d1.length - 1])).toBe("day_end");
    expect(d1[0].travelMinutes).toBeGreaterThan(0);
    expect(d1[0].travelMeters).toBeGreaterThan(0);
  });
});

describe("departure day (flight 18:00 from Malpensa, check-out 10:00)", () => {
  const p = prefs();
  const d2 = plan(p)[2].stops;
  it("checks out first, by the check-out time, and stores bags while sightseeing", () => {
    expect(roles(d2).slice(0, 2)).toEqual(["check_out", "luggage_drop"]);
    expect(role(d2[0])).toBe("check_out");
    expect(toMinutes(d2[0].startTime!) + d2[0].durationMin).toBeLessThanOrEqual(10 * 60);
    expect(roles(d2)).toContain("luggage_pickup");
  });
  it("reaches the airport by 16:00 (2 h before the flight) via Centrale", () => {
    const dep = d2[d2.length - 1];
    expect(role(dep)).toBe("departure");
    expect(dep.details?.deadline).toBe("16:00");
    expect(toMinutes(dep.startTime!)).toBeLessThanOrEqual(16 * 60);
    expect(role(d2[d2.length - 2])).toBe("departure_point");
  });
  it("leave-by time accounts for the transfer", () => {
    const leave = departureLeaveByMinutes(p, staysFor(p, MILAN)[MILAN], centre)!;
    expect(leave).toBeLessThan(16 * 60 - 51);
  });
});

describe("late arrival and unknown accommodation", () => {
  it("arriving at 19:00 goes straight to check-in, no luggage storage", () => {
    const d0 = plan(prefs({ departureTime: "19:00" }))[0].stops;
    expect(roles(d0)).not.toContain("luggage_drop");
    expect(roles(d0).slice(0, 3)).toEqual(["arrival", "arrival_point", "check_in"]);
  });
  it("without the accommodation's location, bags are stored near the arrival station and collected before check-in", () => {
    const d0 = plan(prefs({ accommodation: { status: "recommend" } }))[0].stops;
    const drop = d0.find((s) => role(s) === "luggage_drop")!;
    expect(Math.abs(drop.lat! - 45.4862) < 0.001).toBe(true); // Milano Centrale
    const r = roles(d0);
    expect(r.indexOf("luggage_pickup")).toBe(r.indexOf("check_in") - 1);
    expect(r).not.toContain("day_end"); // no location → no invented "back home" leg
  });
  it("no arrival details: the first day simply starts at the accommodation", () => {
    const d0 = plan(prefs({ departureTime: null, arrival: null }))[0].stops;
    expect(role(d0[0])).toBe("day_start");
  });
});

describe("travel day between cities with known stations", () => {
  const seg = (slug: string, lat: number, lng: number, type: TripSegment["type"], days: number, leg?: TripSegment["leg"]): TripSegment => ({ slug, destinationId: `dest-${slug}`, name: slug, countryCode: "IT", lat, lng, days, type, leg: leg ?? null });
  const segments = [seg("milan", 45.4642, 9.19, "base", 2), seg("bologna", 44.4949, 11.3426, "stay", 2, { mode: "train", minutes: 65, direct: true, source: "curated", distanceKm: 200 })];
  const p = prefs({ startDate: "2027-05-10", endDate: "2027-05-13", segments, departureTime: null, arrival: null, returnTime: null, stays: { bologna: { name: "B&B Bologna", lat: 44.497, lng: 11.345 } } });
  const places = { milan: milanPlaces().map((x) => ({ ...x, destinationSlug: "milan" })), bologna: milanPlaces().map((x, i) => ({ ...x, id: `b-${i}`, lat: x.lat - 0.97, lng: x.lng + 2.15, destinationSlug: "bologna" })) };
  const slots = [
    { index: 0, segment: segments[0], kind: "normal" as const },
    { index: 1, segment: segments[0], kind: "normal" as const },
    { index: 2, segment: segments[1], kind: "travel" as const, from: segments[0] },
    { index: 3, segment: segments[1], kind: "normal" as const },
  ];
  const ctx: LogisticsContext = {
    prefs: p,
    stays: staysFor(p, "dest-milan"),
    stations: { "dest-milan": { name: "Milano Centrale", lat: 45.4862, lng: 9.2045 }, "dest-bologna": { name: "Bologna Centrale", lat: 44.5058, lng: 11.343 } },
    baseDestinationId: "dest-milan",
  };
  const days = applyLogistics(buildPlan({ prefs: p, slots, dates: ["2027-05-10", "2027-05-11", "2027-05-12", "2027-05-13"], places }), ctx);
  const t = days[2].stops;
  it("accommodation → departure station → train → arrival station → next accommodation", () => {
    const journey = t.find((s) => s.details?.intercity)!;
    const r = t.map((s) => role(s) ?? (s.details?.intercity ? "journey" : null)).filter(Boolean);
    expect(r.slice(0, 3)).toEqual(["check_out", "journey", "station_arrival"]);
    expect(toMinutes(t[0].startTime!) + t[0].durationMin).toBeLessThanOrEqual(10 * 60);
    expect(journey.lat).toBe(45.4862);
    expect(journey.details?.intercity?.fromStation).toBe("Milano Centrale");
    expect(journey.details?.intercity?.toStation).toBe("Bologna Centrale");
    expect(r).toContain("check_in");
    const ci = t.find((s) => role(s) === "check_in")!;
    expect(ci.title).toBe("B&B Bologna");
    expect(toMinutes(ci.startTime!)).toBeGreaterThanOrEqual(16 * 60);
  });
  it("the check-out leg goes to the real station (not a fixed guess)", () => {
    const co = t.find((s) => role(s) === "check_out")!;
    expect(co.travelMeters).toBeGreaterThan(0);
  });
});

describe("editing keeps logistics in place", () => {
  it("pinLogistics keeps role stops at their index", () => {
    const mk = (title: string, r?: string): PlannedStop => ({ kind: "attraction", title, durationMin: 60, locked: false, details: r ? { role: r as never } : null });
    const before = [mk("start", "day_start"), mk("A"), mk("B"), mk("C"), mk("end", "day_end")];
    const out = pinLogistics(before, [mk("end", "day_end"), mk("C"), mk("start", "day_start"), mk("A"), mk("B")]);
    expect(out.map((s) => s.title)).toEqual(["start", "C", "A", "B", "end"]);
  });
  it("new stops go before the return to the accommodation", () => {
    const stops = plan(prefs())[1].stops;
    expect(role(stops[insertionIndex(stops)]) === "day_end" || stops[insertionIndex(stops)].mealType === "dinner").toBe(true);
  });
});
