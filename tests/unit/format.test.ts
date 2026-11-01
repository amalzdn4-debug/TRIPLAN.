import { describe, it, expect } from "vitest";
import { formatDistance, formatDuration, addDays, daysBetween, countryName, formatTime } from "@/lib/format";

describe("format", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2027-01-31", 1)).toBe("2027-02-01");
    expect(daysBetween("2027-01-01", "2027-01-03")).toBe(3); // inclusive count of trip days
  });
  it("formats distances in metric and imperial", () => {
    expect(formatDistance(1500, "en")).toMatch(/1\.5\s?km/);
    expect(formatDistance(1609, "en", "imperial")).toMatch(/1(\.0)?\s?mi/);
  });
  it("formats durations", () => {
    expect(formatDuration(90, "en")).toMatch(/1.*30/);
  });
  it("localises country names", () => {
    expect(countryName("JP", "en")).toBe("Japan");
    expect(countryName("JP", "fr")).toBe("Japon");
  });
  it("formats times per locale", () => {
    expect(formatTime("19:00", "en", "24h")).toBe("19:00");
  });
});
