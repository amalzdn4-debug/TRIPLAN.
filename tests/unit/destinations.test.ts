import { describe, it, expect } from "vitest";
import { SEED_DESTINATIONS, COUNTRY_CONTINENT } from "@/data/destinations";
import { parseMonths } from "@/data/world/define";

const STYLES = ["city_break", "culture", "beach", "nature", "food", "romantic", "family", "adventure", "luxury", "budget"];
const EXPERIENCES = ["museums", "architecture", "history", "nightlife", "shopping", "beaches", "hiking", "food", "markets", "photography", "relaxation", "local"];
const CLIMATES = ["temperate", "mediterranean", "tropical", "desert", "continental", "subtropical", "oceanic", "alpine", "subarctic"];
const CONTINENTS = ["europe", "mena", "asia", "north_america", "south_america", "africa", "oceania"];

describe("destination catalogue", () => {
  it("has at least 300 destinations on every continent", () => {
    expect(SEED_DESTINATIONS.length).toBeGreaterThanOrEqual(300);
    for (const c of CONTINENTS) expect(SEED_DESTINATIONS.filter((d) => d.continent === c).length, c).toBeGreaterThanOrEqual(10);
  });

  it("uses unique, URL-safe slugs", () => {
    const slugs = SEED_DESTINATIONS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s), s).toBe(true);
  });

  it("every entry has valid data", () => {
    for (const d of SEED_DESTINATIONS) {
      const at = d.slug;
      expect(COUNTRY_CONTINENT[d.country], at).toBeTruthy();
      expect(COUNTRY_CONTINENT[d.country].continent, at).toBe(d.continent);
      expect(Math.abs(d.lat) <= 90 && Math.abs(d.lng) <= 180, at).toBe(true);
      expect(() => new Intl.DateTimeFormat("en", { timeZone: d.tz }), `${at} tz ${d.tz}`).not.toThrow();
      expect(CLIMATES.includes(d.climate), `${at} climate`).toBe(true);
      for (const s of d.styles) expect(STYLES.includes(s), `${at} style ${s}`).toBe(true);
      for (const e of d.experiences) expect(EXPERIENCES.includes(e), `${at} experience ${e}`).toBe(true);
      expect(d.bestMonths.length > 0 && d.bestMonths.every((m) => m >= 1 && m <= 12), `${at} months`).toBe(true);
      expect(d.days[0] >= 1 && d.days[0] <= d.days[1] && d.days[1] <= 14, `${at} days`).toBe(true);
      expect(d.summary.length >= 30 && d.summary.length <= 160, `${at} summary length ${d.summary.length}`).toBe(true);
      expect(d.wiki, `${at} wiki`).toBeTruthy();
    }
  });

  it("parses month ranges, including ranges across the new year", () => {
    expect(parseMonths("4-6,9-10")).toEqual([4, 5, 6, 9, 10]);
    expect(parseMonths("11-3")).toEqual([1, 2, 3, 11, 12]);
    expect(parseMonths("1-12")).toHaveLength(12);
    expect(parseMonths("7")).toEqual([7]);
  });
});
