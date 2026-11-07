import { describe, it, expect } from "vitest";
import { geocode, photonUrl, toResults } from "@/lib/geocode";
import { normalizeTime } from "@/lib/time";

/** Shaped like Photon's GeoJSON response (values written for the test). */
const viaNoale = { geometry: { coordinates: [9.2235, 45.5065] as [number, number] }, properties: { street: "Via Noale", housenumber: "7", postcode: "20132", city: "Milano", country: "Italia", osm_key: "place", osm_value: "house" } };
const mxp = { geometry: { coordinates: [8.7255, 45.6301] as [number, number] }, properties: { name: "Aeroporto di Milano-Malpensa", city: "Ferno", country: "Italia", osm_key: "aeroway", osm_value: "aerodrome" } };
const centrale = { geometry: { coordinates: [9.2045, 45.4862] as [number, number] }, properties: { name: "Milano Centrale", city: "Milano", country: "Italia", osm_key: "railway", osm_value: "station" } };

describe("address search (Photon)", () => {
  it("builds the request with language, bias and type filters", () => {
    const u = new URL(photonUrl("via noale 7", { kind: "address", lang: "it", near: { lat: 45.4642, lng: 9.19 } }));
    expect(u.host).toBe("photon.komoot.io");
    expect(u.searchParams.get("lang")).toBe("it");
    expect(u.searchParams.get("lat")).toBe("45.4642");
    expect(new URL(photonUrl("malpensa", { kind: "airport" })).searchParams.getAll("osm_tag")).toEqual(["aeroway:aerodrome"]);
    expect(new URL(photonUrl("centrale", { kind: "station" })).searchParams.getAll("osm_tag")).toEqual(["railway:station"]);
    expect(new URL(photonUrl("x y z", { kind: "address", lang: "ar" })).searchParams.has("lang")).toBe(false); // unsupported → local names
  });
  it("turns a street address into a labelled point (Via Noale 7, Milano)", () => {
    const [r] = toResults([viaNoale], "address");
    expect(r.label).toBe("Via Noale 7, 20132 Milano Italia");
    expect([r.lat, r.lng]).toEqual([45.5065, 9.2235]);
    expect(r.kind).toBe("address");
  });
  it("airport/station searches keep only airports/stations", () => {
    expect(toResults([viaNoale, mxp, centrale], "airport").map((r) => r.name)).toEqual(["Aeroporto di Milano-Malpensa"]);
    expect(toResults([viaNoale, mxp, centrale], "station").map((r) => r.name)).toEqual(["Milano Centrale"]);
  });
  it("returns null (not a fake result) when the service fails, and caches successes", async () => {
    let calls = 0;
    const fail = (async () => { calls++; return new Response("nope", { status: 503 }); }) as typeof fetch;
    expect(await geocode("via noale 7 milano", { kind: "address" }, fail)).toBeNull();
    const ok = (async () => { calls++; return new Response(JSON.stringify({ features: [viaNoale] }), { status: 200 }); }) as typeof fetch;
    expect((await geocode("via noale 7 milano", { kind: "address" }, ok))?.length).toBe(1);
    expect((await geocode("Via Noale 7 Milano", { kind: "address" }, ok))?.length).toBe(1);
    expect(calls).toBe(2);
  });
});

describe("24-hour time field", () => {
  it("normalises what people type", () => {
    expect(normalizeTime("930")).toBe("09:30");
    expect(normalizeTime("9.30")).toBe("09:30");
    expect(normalizeTime("16")).toBe("16:00");
    expect(normalizeTime("16:5")).toBe("16:50");
    expect(normalizeTime("25:00")).toBeNull();
    expect(normalizeTime("")).toBe("");
  });
});
