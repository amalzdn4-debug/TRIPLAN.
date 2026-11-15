import { describe, it, expect } from "vitest";
import { legsToCheck, type LegStop } from "@/lib/itinerary/live-legs";

const st = (id: string, lat: number | null, lng: number | null, extra: Partial<LegStop> = {}): LegStop => ({ id, lat, lng, travelMode: "walking", travelMeters: 800, details: null, ...extra });

describe("which legs are sent to Google Maps", () => {
  it("asks for normal legs between located stops", () => {
    const legs = legsToCheck([st("a", 45.46, 9.19), st("b", 45.47, 9.2), st("c", 45.48, 9.21)]);
    expect(legs.map((l) => l.stopId)).toEqual(["a", "b"]);
    expect(legs[0].to).toEqual({ lat: 45.47, lng: 9.2 });
  });
  it("skips verified fixed legs, intercity journeys, unlocated stops and same-spot legs", () => {
    const legs = legsToCheck([
      st("airport", 45.63, 8.72, { details: { role: "arrival", fixedLeg: { minutes: 56, mode: "transit" } } }),
      st("centrale", 45.486, 9.204),
      st("journey", 45.488, 9.207, { details: { intercity: { from: "Milan", to: "Bologna", mode: "train", minutes: 65, direct: true, source: "curated", distanceKm: 200, direction: "onward", fromStation: "Milano Centrale" } } }),
      st("meal", null, null),
      st("x", 45.47, 9.2),
      st("y", 45.47, 9.2),
    ]);
    expect(legs.map((l) => l.stopId)).toEqual(["centrale"]);
  });
  it("never sends more than the per-day maximum", () => {
    const many = Array.from({ length: 30 }, (_, i) => st(`s${i}`, 45.46 + i * 0.003, 9.19));
    expect(legsToCheck(many, 14)).toHaveLength(14);
  });
});
