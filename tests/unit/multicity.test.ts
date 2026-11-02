import { describe, it, expect } from "vitest";
import { SEED_DESTINATIONS } from "@/data/destinations";
import { SEED_CONNECTIONS } from "@/data/connections";
import { nearbyDestinations, type NearbyCandidate } from "@/lib/nearby";
import { suggestSplit, segmentsFor, layoutDays, stayCapacity, type BaseInfo, type NearbyWithId } from "@/lib/itinerary/split";
import { buildPlan, bestOrder, assignDayGroups, toMinutes } from "@/lib/itinerary/engine";
import type { CandidatePlace } from "@/lib/itinerary/types";
import { samplePrefs } from "./fixtures";

const cands: NearbyCandidate[] = SEED_DESTINATIONS.map((d) => ({ slug: d.slug, city: d.city, countryCode: d.country, lat: d.lat, lng: d.lng, kind: d.kind ?? "city", daysMin: d.days[0], daysMax: d.days[1], popularity: d.popularity }));
const conns = SEED_CONNECTIONS.map((c) => ({ ...c }));
const lisbonSeed = SEED_DESTINATIONS.find((d) => d.slug === "lisbon")!;
const lisbon: BaseInfo = { slug: "lisbon", destinationId: "id-lisbon", name: "Lisbon", countryCode: "PT", lat: lisbonSeed.lat, lng: lisbonSeed.lng, daysMin: 3, daysMax: 4, placeCount: 8 };
const near: NearbyWithId[] = nearbyDestinations({ ...lisbon, kind: "city" }, cands, conns).map((n) => ({ ...n, destinationId: `id-${n.slug}` }));

/** Synthetic places around a centre (not real venues). */
function placesAround(prefix: string, lat: number, lng: number, n = 8): CandidatePlace[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${i}`,
    name: `${prefix} place ${i + 1}`,
    kind: "attraction",
    tags: i % 3 === 0 ? ["museums"] : ["architecture"],
    durationMin: 90,
    neighborhood: i < n / 2 ? "West" : "East",
    lat: lat + (i < n / 2 ? 0 : 0.02) + i * 0.001,
    lng: lng + (i < n / 2 ? 0 : 0.03) + i * 0.001,
    destinationSlug: prefix,
  }));
}

describe("multi-city suggestions", () => {
  it("does not suggest anything when the trip fits the destination", () => {
    expect(stayCapacity(lisbon, "balanced")).toBe(3);
    expect(suggestSplit(lisbon, 3, "balanced", near)).toBeNull();
    expect(suggestSplit(lisbon, 2, "balanced", near)).toBeNull();
  });

  it("suggests 3 days in Lisbon + 2 in Porto for a 5-day trip", () => {
    const s = suggestSplit(lisbon, 5, "balanced", near)!;
    expect(s).toBeDefined();
    const porto = s.options.find((o) => o.extras.some((e) => e.slug === "porto" && e.type === "stay"))!;
    expect(porto).toBeDefined();
    expect(porto.baseDays).toBe(3);
    expect(porto.extras.find((e) => e.slug === "porto")!.days).toBe(2);
    expect(porto.extras.find((e) => e.slug === "porto")!.leg!.mode).toBe("train");
  });

  it("prefers a day trip for a single spare day", () => {
    const s = suggestSplit(lisbon, 4, "balanced", near)!;
    expect(s.options[0].extras.every((e) => e.type === "day_trip")).toBe(true);
    expect(s.options[0].baseDays).toBe(4);
  });

  it("lays out base days, day trips and travel days in order", () => {
    const s = suggestSplit(lisbon, 6, "balanced", near)!;
    const opt = s.options.find((o) => o.extras.some((e) => e.type === "stay"))!;
    const segs = segmentsFor(lisbon, opt);
    const slots = layoutDays(segs, 6);
    expect(slots).toHaveLength(6);
    expect(slots[0].segment.slug).toBe("lisbon");
    expect(slots[0].kind).toBe("normal");
    const travel = slots.find((x) => x.kind === "travel")!;
    expect(travel.from!.slug).toBe("lisbon");
    // nothing after the travel day is in the base again
    const ti = slots.indexOf(travel);
    expect(slots.slice(ti).every((x) => x.segment.slug === travel.segment.slug)).toBe(true);
  });
});

describe("multi-city itinerary", () => {
  const porto = SEED_DESTINATIONS.find((d) => d.slug === "porto")!;
  const sintra = SEED_DESTINATIONS.find((d) => d.slug === "sintra")!;
  const places = {
    lisbon: placesAround("lisbon", lisbon.lat, lisbon.lng),
    porto: placesAround("porto", porto.lat, porto.lng),
    sintra: placesAround("sintra", sintra.lat, sintra.lng, 4),
  };
  const opt = suggestSplit(lisbon, 5, "balanced", near)!.options.find((o) => o.extras.some((e) => e.slug === "porto"))!;
  const slots = layoutDays(segmentsFor(lisbon, opt), 5);
  const dates = ["2027-05-10", "2027-05-11", "2027-05-12", "2027-05-13", "2027-05-14"];
  const days = buildPlan({ prefs: samplePrefs({ startDate: dates[0], endDate: dates[4] }), slots, dates, places });

  it("builds one day per date, tagged with its destination", () => {
    expect(days).toHaveLength(5);
    expect(days[0].destinationId).toBe("id-lisbon");
    expect(days[4].destinationId).toBe("id-porto");
  });

  it("adds a train journey with transfer times on the travel day", () => {
    const travel = days.find((d) => d.kind === "travel")!;
    const t = travel.stops.find((s) => s.kind === "transport")!;
    expect(t.details!.intercity!.mode).toBe("train");
    expect(t.details!.intercity!.minutes).toBe(170);
    const i = travel.stops.indexOf(t);
    expect(travel.stops[i - 1].travelMinutes).toBe(25); // getting to the station
    // anything after arrival starts after the train gets in
    const next = travel.stops[i + 1];
    if (next) expect(toMinutes(next.startTime!)).toBeGreaterThanOrEqual(toMinutes(t.startTime!) + 170);
  });

  it("never mixes another city's places into a day", () => {
    for (const d of days) {
      const slug = d.destinationId!.replace("id-", "");
      for (const s of d.stops.filter((x) => x.kind === "attraction")) expect(s.placeId!.startsWith(slug)).toBe(true);
    }
  });

  it("never repeats a place across the trip", () => {
    const ids = days.flatMap((d) => d.stops.filter((s) => s.placeId).map((s) => s.placeId!));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does day trips out and back, with dinner at the base", () => {
    const opt6 = suggestSplit(lisbon, 4, "balanced", near)!.options[0];
    const slots6 = layoutDays(segmentsFor(lisbon, opt6), 4);
    const trip = buildPlan({ prefs: samplePrefs({ startDate: "2027-05-10", endDate: "2027-05-13" }), slots: slots6, dates: dates.slice(0, 4), places: { ...places, [opt6.extras[0].slug]: placesAround(opt6.extras[0].slug, opt6.extras[0].lat, opt6.extras[0].lng, 4) } }).find((d) => d.kind === "day_trip")!;
    const legs = trip.stops.filter((s) => s.kind === "transport");
    expect(legs).toHaveLength(2);
    expect(legs[0].details!.intercity!.direction).toBe("out");
    expect(legs[1].details!.intercity!.direction).toBe("back");
    expect(trip.stops[trip.stops.length - 1].mealType).toBe("dinner");
  });
});

describe("routing helpers", () => {
  it("finds the shortest order and avoids late museum starts", () => {
    const pts = [
      { id: "a", lat: 0, lng: 0.0, durationMin: 60 },
      { id: "c", lat: 0, lng: 0.02, durationMin: 60 },
      { id: "b", lat: 0, lng: 0.01, durationMin: 60 },
    ];
    expect(bestOrder(pts, { lat: 0, lng: -0.01 }).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("splits places into balanced compact groups", () => {
    const ps = placesAround("x", 41.9, 12.5, 8);
    const groups = assignDayGroups(ps, new Map(), [4, 4]);
    expect(groups.map((g) => g.length)).toEqual([4, 4]);
    for (const g of groups) expect(new Set(g.map((p) => p.neighborhood)).size).toBe(1);
  });
});
