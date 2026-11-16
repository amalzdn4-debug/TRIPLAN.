import { describe, it, expect } from "vitest";
import { admissionOf, admissionScore } from "@/lib/admission";
import { buildItinerary, scorePlace } from "@/lib/itinerary/engine";
import { applyLogistics, staysFor, arrivalReadyMinutes } from "@/lib/itinerary/logistics";
import { samplePlaces, samplePrefs } from "./fixtures";

describe("admission is never assumed", () => {
  it("a museum with no verified entry is unknown, not 'needs a ticket'", () => {
    expect(admissionOf({ wikidataType: "Q33506" })).toBeNull();
    expect(admissionOf({ ticketed: true })).toBeNull();
  });
  it("public spaces are free by nature (square, bridge, fountain); parks and churches are not assumed", () => {
    expect(admissionOf({ wikidataType: "Q174782" })).toEqual({ type: "free", basis: "public_space" });
    expect(admissionOf({ wikidataType: "Q22698" })).toBeNull(); // park
    expect(admissionOf({ wikidataType: "Q16970" })).toBeNull(); // church
  });
  it("an editor's entry needs an https source; free entries carry no price", () => {
    expect(admissionOf({ admission: { type: "paid", price: { amount: 20, currency: "EUR" } } })).toBeNull();
    const a = admissionOf({ admission: { type: "conditional", price: { amount: 15, currency: "EUR" }, freeWhen: "first Sunday of the month", source: "https://museum.example/prices", checked: "2026-11" } });
    expect([a?.type, a?.price?.amount, a?.price?.currency, a?.freeWhen, a?.basis]).toEqual(["conditional", 15, "EUR", "first Sunday of the month", "editor"]);
    expect(admissionOf({ admission: { type: "free", price: { amount: 5, currency: "EUR" }, source: "https://x.example/" } })?.price).toBeNull();
  });
  it("'prefer free' nudges free places up and paid down; unknown stays neutral", () => {
    expect(admissionScore("prefer_free", "free")).toBeGreaterThan(0);
    expect(admissionScore("prefer_free", "paid")).toBeLessThan(0);
    expect(admissionScore("prefer_free", null)).toBe(0);
    expect(admissionScore("any", "paid")).toBe(0);
    const p = { ...samplePlaces()[0], admission: "free" as const };
    const q = { ...samplePlaces()[0], admission: "paid" as const };
    const prefs = samplePrefs({ admissionPreference: "prefer_free" });
    expect(scorePlace(p, prefs)).toBeGreaterThan(scorePlace(q, prefs));
  });
});

describe("one-day trip", () => {
  const centre = { lat: 41.9, lng: 12.49 };
  const fco = { mode: "plane" as const, name: "Fiumicino", lat: 41.8003, lng: 12.2389 };
  const p = samplePrefs({ startDate: "2027-05-10", endDate: "2027-05-10", arrival: fco, departure: fco, departureTime: "08:30", returnTime: "21:00" });
  const ctx = { prefs: p, stays: staysFor(p, "rome"), stations: {}, baseDestinationId: "rome" };
  const days = applyLogistics(buildItinerary(p, samplePlaces(), 30, { arrivalReady: arrivalReadyMinutes(p, ctx.stays.rome, centre) }), ctx);
  const roles = days[0].stops.map((s) => s.details?.role).filter(Boolean);
  it("is a single day: arrival → sights → departure, no check-in/check-out or luggage", () => {
    expect(days).toHaveLength(1);
    expect(roles[0]).toBe("arrival");
    expect(roles[roles.length - 1]).toBe("departure");
    expect(roles.some((r) => r === "check_in" || r === "check_out" || r === "luggage_drop")).toBe(false);
  });
  it("fits the day: sights and meals, and reaches the airport 2 h before the flight", () => {
    const sights = days[0].stops.filter((s) => s.kind === "attraction");
    expect(sights.length).toBeGreaterThanOrEqual(2);
    expect(sights.length).toBeLessThanOrEqual(5);
    expect(days[0].stops.some((s) => s.mealType === "lunch")).toBe(true);
    const dep = days[0].stops[days[0].stops.length - 1];
    expect(dep.startTime! <= "19:00").toBe(true);
  });
  it("groups the day's sights geographically (one area)", () => {
    const hoods = new Set(days[0].stops.filter((s) => s.kind === "attraction").map((s) => samplePlaces().find((x) => x.id === s.placeId)?.neighborhood));
    expect(hoods.size).toBeLessThanOrEqual(2);
  });
});
