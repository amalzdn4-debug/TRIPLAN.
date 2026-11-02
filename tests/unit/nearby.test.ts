import { describe, it, expect } from "vitest";
import { SEED_DESTINATIONS } from "@/data/destinations";
import { SEED_CONNECTIONS } from "@/data/connections";
import { nearbyDestinations, legBetween, bestCuratedLeg, suitabilityFor, type NearbyCandidate } from "@/lib/nearby";
import { pickDiverseHero } from "@/lib/hero";

const cands: NearbyCandidate[] = SEED_DESTINATIONS.map((d) => ({ slug: d.slug, city: d.city, countryCode: d.country, lat: d.lat, lng: d.lng, kind: d.kind ?? "city", daysMin: d.days[0], daysMax: d.days[1], popularity: d.popularity }));
const conns = SEED_CONNECTIONS.map((c) => ({ ...c }));
const by = (slug: string) => cands.find((c) => c.slug === slug)!;

describe("curated connections data", () => {
  it("only references catalogue destinations", () => {
    const slugs = new Set(cands.map((c) => c.slug));
    for (const c of SEED_CONNECTIONS) {
      expect(slugs.has(c.from), c.from).toBe(true);
      expect(slugs.has(c.to), c.to).toBe(true);
    }
  });
});

describe("nearby destinations", () => {
  it("suggests Porto and Sintra from Lisbon with practical transport", () => {
    const near = nearbyDestinations(by("lisbon"), cands, conns);
    const porto = near.find((n) => n.slug === "porto")!;
    const sintra = near.find((n) => n.slug === "sintra")!;
    expect(porto.leg.mode).toBe("train");
    expect(porto.leg.minutes).toBe(170);
    expect(porto.leg.source).toBe("curated");
    expect(sintra.suitability).toBe("day_trip");
  });

  it("prefers a flight only when it is genuinely faster door to door", () => {
    const athSan = bestCuratedLeg(conns.filter((c) => c.from === "athens" && c.to === "santorini"), 230)!;
    expect(athSan.mode).toBe("flight"); // 45 + 120 min airport time beats a 330 min ferry
    const bcnPmi = bestCuratedLeg(conns.filter((c) => c.from === "barcelona" && c.to === "palma-de-mallorca"), 200)!;
    expect(bcnPmi.mode).toBe("flight");
  });

  it("never estimates a road trip to an island", () => {
    expect(legBetween(by("lisbon"), by("madeira"), conns)).toBeNull();
  });

  it("labels uncurated legs as road estimates and ignores far-away places", () => {
    const leg = legBetween(by("florence"), by("bologna"), [])!;
    expect(leg.source).toBe("estimate");
    expect(leg.mode).toBe("car");
    expect(legBetween(by("paris"), by("rome"), [])).toBeNull(); // > 450 km, no curated link
  });

  it("classifies trips by door-to-door time", () => {
    const base = { mode: "train" as const, minutes: 0, direct: true, source: "curated" as const, distanceKm: 0 };
    expect(suitabilityFor({ ...base, effectiveMinutes: 60 })).toBe("day_trip");
    expect(suitabilityFor({ ...base, effectiveMinutes: 200 })).toBe("short_stay");
    expect(suitabilityFor({ ...base, effectiveMinutes: 300 })).toBe("multi_day");
  });

  it("does not list the origin itself and respects the limit", () => {
    const near = nearbyDestinations(by("rome"), cands, conns, { limit: 3 });
    expect(near.length).toBeLessThanOrEqual(3);
    expect(near.some((n) => n.slug === "rome")).toBe(false);
  });
});

describe("slideshow variety", () => {
  it("rotates across continents and kinds of place", () => {
    const items = [
      { slug: "a", continent: "europe", kind: "city", popularity: 90 },
      { slug: "b", continent: "europe", kind: "city", popularity: 89 },
      { slug: "c", continent: "europe", kind: "island", popularity: 50 },
      { slug: "d", continent: "asia", kind: "city", popularity: 80 },
      { slug: "e", continent: "africa", kind: "nature", popularity: 40 },
    ];
    const picked = pickDiverseHero(items, 4).map((x) => x.slug);
    expect(picked.slice(0, 3).sort()).toEqual(["a", "d", "e"]); // one per continent first
    expect(picked[3]).toBe("c"); // then a different kind for Europe, not another city
  });
});
