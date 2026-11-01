import { describe, it, expect } from "vitest";
import { haversineMeters, chooseMode, estimateLeg, googleMapsDirectionsUrl, googleMapsPlaceUrl, centroid } from "@/lib/geo";

describe("geo", () => {
  it("computes great-circle distance (Paris → London ≈ 344 km)", () => {
    const d = haversineMeters({ lat: 48.8566, lng: 2.3522 }, { lat: 51.5074, lng: -0.1278 });
    expect(d).toBeGreaterThan(340_000);
    expect(d).toBeLessThan(348_000);
  });

  it("is zero for identical points", () => {
    expect(haversineMeters({ lat: 10, lng: 10 }, { lat: 10, lng: 10 })).toBe(0);
  });

  it("chooses walking for short legs and transit/driving for long ones", () => {
    expect(chooseMode("public", 500)).toBe("walking");
    expect(chooseMode("public", 5000)).toBe("transit");
    expect(chooseMode("driving", 5000)).toBe("driving");
    expect(chooseMode("walking", 1500)).toBe("walking");
    expect(chooseMode("cycling", 4000)).toBe("cycling");
  });

  it("estimates leg durations with a detour factor", () => {
    const a = { lat: 41.9, lng: 12.48 };
    const b = { lat: 41.909, lng: 12.48 }; // ~1 km
    const walk = estimateLeg(a, b, "walking");
    expect(walk.meters).toBeGreaterThan(1000);
    expect(walk.minutes).toBeGreaterThanOrEqual(14);
    expect(walk.minutes).toBeLessThanOrEqual(20);
    expect(estimateLeg(a, a, "walking")).toEqual({ minutes: 0, meters: 0 });
  });

  it("builds a Google Maps directions URL with waypoints", () => {
    const url = googleMapsDirectionsUrl([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 6 }], "walking")!;
    expect(url).toContain("https://www.google.com/maps/dir/?api=1");
    const q = new URL(url).searchParams;
    expect(q.get("origin")).toBe("1.000000,2.000000");
    expect(q.get("destination")).toBe("5.000000,6.000000");
    expect(q.get("waypoints")).toBe("3.000000,4.000000");
    expect(url).toContain("travelmode=walking");
    expect(googleMapsDirectionsUrl([{ lat: 1, lng: 2 }])).toBeNull();
  });

  it("encodes place search URLs", () => {
    expect(googleMapsPlaceUrl("Café & Co", "Paris")).toContain(encodeURIComponent("Café & Co"));
  });

  it("computes a centroid", () => {
    expect(centroid([{ lat: 0, lng: 0 }, { lat: 2, lng: 2 }])).toEqual({ lat: 1, lng: 1 });
    expect(centroid([])).toBeNull();
  });
});
