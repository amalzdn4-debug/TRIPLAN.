import { describe, it, expect } from "vitest";
import { buildItinerary, buildDay, enumerateDates, scheduleDay, toMinutes, toHHMM, scorePlace } from "@/lib/itinerary/engine";
import { samplePlaces, samplePrefs } from "./fixtures";

const mins = (t?: string | null) => toMinutes(t ?? "00:00");

describe("itinerary engine", () => {
  it("converts times", () => {
    expect(toMinutes("09:30")).toBe(570);
    expect(toHHMM(570)).toBe("09:30");
  });

  it("enumerates inclusive dates and caps the length", () => {
    expect(enumerateDates("2027-01-30", "2027-02-02", 21)).toEqual(["2027-01-30", "2027-01-31", "2027-02-01", "2027-02-02"]);
    expect(enumerateDates("2027-01-01", "2027-03-01", 21)).toHaveLength(21);
  });

  it("scores places matching interests higher", () => {
    const prefs = samplePrefs({ interests: ["nature"] });
    const [museum, , park] = samplePlaces();
    expect(scorePlace(park, prefs)).toBeGreaterThan(scorePlace(museum, prefs));
  });

  it("builds one day per date without repeating places", () => {
    const days = buildItinerary(samplePrefs(), samplePlaces(), 21);
    expect(days).toHaveLength(3);
    const ids = days.flatMap((d) => d.stops.map((s) => s.placeId).filter(Boolean));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only schedules places from the database (never invents venues)", () => {
    const places = samplePlaces();
    const known = new Set(places.map((p) => p.id));
    for (const day of buildItinerary(samplePrefs(), places, 21))
      for (const s of day.stops) if (s.placeId) expect(known.has(s.placeId)).toBe(true);
  });

  it("places meals at realistic times and in order", () => {
    for (const day of buildItinerary(samplePrefs(), samplePlaces(), 21)) {
      const times = day.stops.map((s) => mins(s.startTime));
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      const meal = (t: string) => day.stops.find((s) => s.mealType === t);
      expect(meal("breakfast")).toBeTruthy();
      const lunch = meal("lunch");
      expect(lunch).toBeTruthy();
      expect(mins(lunch!.startTime)).toBeGreaterThanOrEqual(toMinutes("11:30"));
      expect(mins(lunch!.startTime)).toBeLessThanOrEqual(toMinutes("15:00"));
      expect(mins(meal("dinner")!.startTime)).toBeGreaterThanOrEqual(toMinutes("19:00"));
    }
  });

  it("never attaches prices to generated stops (no fabricated costs)", () => {
    for (const day of buildItinerary(samplePrefs(), samplePlaces(), 21))
      for (const s of day.stops) expect(s.costMin ?? null).toBeNull();
  });

  it("labels computed travel legs as estimates", () => {
    const day = buildItinerary(samplePrefs(), samplePlaces(), 21)[0];
    const legs = day.stops.filter((s) => s.travelMinutes != null);
    expect(legs.length).toBeGreaterThan(0);
    for (const s of legs) expect(s.travelSource).toBe("estimate");
  });

  it("respects pace (relaxed < packed)", () => {
    const count = (pace: "relaxed" | "packed") =>
      buildItinerary(samplePrefs({ pace, startDate: "2027-05-10", endDate: "2027-05-10" }), samplePlaces(), 21)[0].stops.filter((s) => s.kind === "attraction").length;
    expect(count("relaxed")).toBeLessThan(count("packed"));
  });

  it("keeps locked stops when regenerating a day", () => {
    const places = samplePlaces();
    const prefs = samplePrefs();
    const locked = { kind: "attraction" as const, title: "My locked spot", placeId: "p2-4", lat: places[14].lat, lng: places[14].lng, durationMin: 60, locked: true };
    const { day } = buildDay({ dayIndex: 0, date: "2027-05-10", prefs, pool: places, scores: new Map(), lockedStops: [locked] });
    const kept = day.stops.find((s) => s.placeId === "p2-4");
    expect(kept?.locked).toBe(true);
    expect(day.stops.filter((s) => s.placeId === "p2-4")).toHaveLength(1);
  });

  it("starts later on arrival day and skips dinner on departure day", () => {
    const days = buildItinerary(samplePrefs({ departureTime: "10:00", returnTime: "18:00" }), samplePlaces(), 21);
    expect(mins(days[0].startTime)).toBeGreaterThanOrEqual(toMinutes("12:00"));
    expect(days[days.length - 1].stops.some((s) => s.mealType === "dinner")).toBe(false);
  });

  it("adds evening drinks only for nightlife lovers", () => {
    const withNight = buildItinerary(samplePrefs({ interests: ["nightlife"] }), samplePlaces(), 21)[1];
    const without = buildItinerary(samplePrefs(), samplePlaces(), 21)[1];
    expect(withNight.stops.some((s) => s.mealType === "drinks")).toBe(true);
    expect(without.stops.some((s) => s.mealType === "drinks")).toBe(false);
  });

  it("still produces a usable day when the destination has no curated places", () => {
    const [day] = buildItinerary(samplePrefs({ startDate: "2027-05-10", endDate: "2027-05-10" }), [], 21);
    expect(day.stops.some((s) => s.mealType === "dinner")).toBe(true);
  });

  it("recomputes times and legs after reordering", () => {
    const day = buildItinerary(samplePrefs(), samplePlaces(), 21)[0];
    const idx = day.stops.map((s, i) => (s.kind === "attraction" ? i : -1)).filter((i) => i >= 0);
    const swapped = [...day.stops];
    [swapped[idx[0]], swapped[idx[1]]] = [swapped[idx[1]], swapped[idx[0]]];
    const out = scheduleDay(swapped, day.startTime, "public");
    expect(out[0].startTime).toBe(day.startTime);
    const times = out.map((s) => mins(s.startTime));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(out[idx[0]].placeId).toBe(day.stops[idx[1]].placeId);
  });

  it("never schedules dinner before 19:00, even if moved earlier", () => {
    const day = buildItinerary(samplePrefs(), samplePlaces(), 21)[0];
    const dinner = day.stops.find((s) => s.mealType === "dinner")!;
    const out = scheduleDay([dinner, ...day.stops.filter((s) => s !== dinner)], day.startTime, "public");
    expect(mins(out[0].startTime)).toBeGreaterThanOrEqual(toMinutes("19:00"));
  });
});
