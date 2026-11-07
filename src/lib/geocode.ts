/**
 * Address / airport / station search for the planner, backed by Photon (OpenStreetMap data,
 * https://photon.komoot.io — free for fair use, built for search-as-you-type).
 * Called only from our own API route (cached, rate-limited); the browser never contacts Photon.
 * GEOCODER_URL can point to a self-hosted or commercial Photon instance instead.
 * Results are © OpenStreetMap contributors (ODbL) — the UI shows that attribution.
 */
export type GeocodeKind = "address" | "airport" | "station";

export interface GeocodeResult {
  label: string;
  name: string;
  lat: number;
  lng: number;
  kind: "address" | "airport" | "station" | "place";
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
}

const PHOTON_LANGS = new Set(["en", "de", "fr", "it"]);
const cache = new Map<string, { at: number; results: GeocodeResult[] }>();
const TTL = 24 * 3600_000;

export function photonUrl(q: string, opts: { kind: GeocodeKind; lang?: string; near?: { lat: number; lng: number } | null }): string {
  const base = process.env.GEOCODER_URL || "https://photon.komoot.io/api";
  const u = new URL(base);
  u.searchParams.set("q", q);
  u.searchParams.set("limit", "6");
  if (opts.lang && PHOTON_LANGS.has(opts.lang)) u.searchParams.set("lang", opts.lang);
  if (opts.near) {
    u.searchParams.set("lat", opts.near.lat.toFixed(4));
    u.searchParams.set("lon", opts.near.lng.toFixed(4));
  }
  if (opts.kind === "airport") u.searchParams.append("osm_tag", "aeroway:aerodrome");
  if (opts.kind === "station") u.searchParams.append("osm_tag", "railway:station");
  return u.toString();
}

export function toResults(features: PhotonFeature[], kind: GeocodeKind): GeocodeResult[] {
  const out: GeocodeResult[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    const c = f.geometry?.coordinates;
    const p = f.properties ?? {};
    if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const street = [p.street, p.housenumber].filter(Boolean).join(" ");
    const name = p.name || street || p.city || "";
    if (!name) continue;
    const place = [p.postcode, p.city ?? p.town ?? p.village, p.country].filter(Boolean).join(" ");
    const label = [p.name && street ? `${p.name}, ${street}` : name, place].filter(Boolean).join(", ");
    if (seen.has(label)) continue;
    seen.add(label);
    const type: GeocodeResult["kind"] = p.osm_key === "aeroway" ? "airport" : p.osm_key === "railway" ? "station" : p.housenumber || p.street ? "address" : "place";
    if (kind === "airport" && type !== "airport") continue;
    if (kind === "station" && type !== "station") continue;
    out.push({ label: label.slice(0, 200), name: name.slice(0, 140), lat: Number(c[1].toFixed(6)), lng: Number(c[0].toFixed(6)), kind: type });
  }
  return out;
}

export async function geocode(q: string, opts: { kind: GeocodeKind; lang?: string; near?: { lat: number; lng: number } | null }, fetchImpl: typeof fetch = fetch): Promise<GeocodeResult[] | null> {
  const key = `${opts.kind}|${opts.lang ?? ""}|${opts.near ? `${opts.near.lat.toFixed(2)},${opts.near.lng.toFixed(2)}` : ""}|${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.results;
  try {
    const res = await fetchImpl(photonUrl(q, opts), { headers: { "User-Agent": "TRIPLAN travel planner", Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const results = toResults(data.features ?? [], opts.kind);
    cache.set(key, { at: Date.now(), results });
    if (cache.size > 2000) for (const [k, v] of cache) if (Date.now() - v.at > TTL || cache.size > 1500) cache.delete(k);
    return results;
  } catch {
    return null;
  }
}
