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

import { routePoints, googleMapsRouteLinks } from "@/lib/geo";

describe("Google Maps day route (no duplicates)", () => {
  const home = { lat: 45.5065, lng: 9.2235 };
  const sight = (i: number) => ({ lat: 45.46 + i * 0.004, lng: 9.19 + i * 0.003 });
  const wps = (url: string) => new URL(url).searchParams.get("waypoints")?.split("|") ?? [];
  it("drops 'lunch near X' points that repeat the sight's position, and merges same-place neighbours", () => {
    const pts = routePoints([{ ...sight(1) }, { ...sight(1), skip: true }, { ...sight(1) }, { ...sight(2) }], home);
    expect(pts).toEqual([home, sight(1), sight(2), home]);
    for (let i = 1; i < pts.length; i++) expect(pts[i]).not.toEqual(pts[i - 1]);
  });
  it("starts and ends at the accommodation exactly once each", () => {
    const pts = routePoints([sight(1), sight(2), sight(3)], home);
    expect(pts[0]).toEqual(home);
    expect(pts[pts.length - 1]).toEqual(home);
    expect(pts.filter((p) => p === home)).toHaveLength(2);
  });
  it("public transport with several stops uses walking (Google ignores waypoints in transit mode)", () => {
    const [url] = googleMapsRouteLinks(routePoints([sight(1), sight(2)], home), "transit");
    expect(new URL(url).searchParams.get("travelmode")).toBe("walking");
    expect(wps(url)).toHaveLength(2);
    const [two] = googleMapsRouteLinks([home, sight(1)], "transit");
    expect(new URL(two).searchParams.get("travelmode")).toBe("transit");
  });
  for (const n of [1, 3, 9, 10, 15]) {
    it(`${n} stops: every stop appears once, in order, with ≤9 waypoints per link`, () => {
      const stops = Array.from({ length: n }, (_, i) => sight(i + 1));
      const links = googleMapsRouteLinks(routePoints(stops, home), "walking");
      const seq: string[] = [];
      links.forEach((u, k) => {
        const q = new URL(u).searchParams;
        expect(wps(u).length).toBeLessThanOrEqual(9);
        if (k === 0) seq.push(q.get("origin")!);
        seq.push(...wps(u), q.get("destination")!);
        if (k > 0) expect(q.get("origin")).toBe(new URL(links[k - 1]).searchParams.get("destination"));
      });
      const fmt = (p: { lat: number; lng: number }) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
      expect(seq).toEqual([home, ...stops, home].map(fmt));
    });
  }
});
