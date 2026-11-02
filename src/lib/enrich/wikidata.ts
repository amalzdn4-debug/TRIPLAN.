/**
 * Wikidata: notable attractions and transport hubs around a destination (CC0 data).
 * "Notable" = covered by several Wikipedia language editions (sitelinks), a robust popularity proxy.
 */
import { getJson, qs } from "./http";
import { fileFromCommonsUrl } from "./commons";
import { SITE_LANGS } from "./wikipedia";

interface Profile {
  label: string;
  minutes: number;
  tags: string[];
}

/** Wikidata classes treated as attractions, with a typical visit length and interest tags. */
export const ATTRACTION_TYPES: Record<string, Profile> = {
  Q33506: { label: "museum", minutes: 120, tags: ["museums", "culture"] },
  Q207694: { label: "art museum", minutes: 150, tags: ["museums", "culture"] },
  Q570116: { label: "tourist attraction", minutes: 75, tags: ["photography", "culture"] },
  Q2319498: { label: "landmark", minutes: 45, tags: ["architecture", "photography"] },
  Q16970: { label: "church", minutes: 40, tags: ["architecture", "history"] },
  Q2977: { label: "cathedral", minutes: 60, tags: ["architecture", "history", "culture"] },
  Q160742: { label: "abbey", minutes: 60, tags: ["history", "architecture"] },
  Q44613: { label: "monastery", minutes: 60, tags: ["history", "architecture", "culture"] },
  Q32815: { label: "mosque", minutes: 40, tags: ["architecture", "culture", "history"] },
  Q34627: { label: "synagogue", minutes: 40, tags: ["history", "culture"] },
  Q44539: { label: "temple", minutes: 45, tags: ["culture", "architecture", "history"] },
  Q842402: { label: "Hindu temple", minutes: 45, tags: ["culture", "architecture"] },
  Q5393308: { label: "Buddhist temple", minutes: 45, tags: ["culture", "architecture"] },
  Q23413: { label: "castle", minutes: 90, tags: ["history", "architecture", "photography"] },
  Q751876: { label: "château", minutes: 90, tags: ["history", "architecture"] },
  Q16560: { label: "palace", minutes: 90, tags: ["history", "architecture", "museums"] },
  Q57821: { label: "fortification", minutes: 75, tags: ["history", "photography"] },
  Q1785071: { label: "fort", minutes: 75, tags: ["history", "photography"] },
  Q839954: { label: "archaeological site", minutes: 120, tags: ["history", "culture"] },
  Q1081138: { label: "historic site", minutes: 75, tags: ["history"] },
  Q15243209: { label: "historic district", minutes: 90, tags: ["local", "history", "photography"] },
  Q4989906: { label: "monument", minutes: 30, tags: ["history", "photography"] },
  Q5003624: { label: "memorial", minutes: 30, tags: ["history"] },
  Q179700: { label: "statue", minutes: 20, tags: ["photography"] },
  Q12518: { label: "tower", minutes: 45, tags: ["architecture", "photography"] },
  Q1440300: { label: "observation tower", minutes: 45, tags: ["photography"] },
  Q483453: { label: "fountain", minutes: 20, tags: ["architecture", "photography"] },
  Q12280: { label: "bridge", minutes: 20, tags: ["architecture", "photography"] },
  Q174782: { label: "square", minutes: 30, tags: ["local", "architecture"] },
  Q330284: { label: "market", minutes: 60, tags: ["markets", "food", "local"] },
  Q24354: { label: "theatre", minutes: 45, tags: ["culture", "architecture"] },
  Q153562: { label: "opera house", minutes: 45, tags: ["culture", "architecture"] },
  Q22698: { label: "park", minutes: 60, tags: ["nature", "relaxation", "family"] },
  Q1107656: { label: "garden", minutes: 60, tags: ["nature", "relaxation"] },
  Q167346: { label: "botanical garden", minutes: 90, tags: ["nature", "relaxation"] },
  Q43501: { label: "zoo", minutes: 150, tags: ["family"] },
  Q2281788: { label: "aquarium", minutes: 120, tags: ["family"] },
  Q40080: { label: "beach", minutes: 150, tags: ["beaches", "relaxation"] },
  Q34038: { label: "waterfall", minutes: 75, tags: ["nature", "photography", "hiking"] },
  Q23397: { label: "lake", minutes: 90, tags: ["nature", "photography"] },
  Q8502: { label: "mountain", minutes: 180, tags: ["nature", "hiking", "photography"] },
  Q35509: { label: "cave", minutes: 90, tags: ["nature", "adventure"] },
  Q46169: { label: "national park", minutes: 240, tags: ["nature", "hiking", "photography"] },
};

export const HUB_TYPES: Record<string, { hub: "airport" | "rail" | "bus"; radiusKm: number; take: number }> = {
  Q1248784: { hub: "airport", radiusKm: 60, take: 2 },
  Q644371: { hub: "airport", radiusKm: 60, take: 2 },
  Q55488: { hub: "rail", radiusKm: 15, take: 2 },
  Q494829: { hub: "bus", radiusKm: 12, take: 1 },
};

export interface WikidataPlace {
  qid: string;
  name: string;
  names: Partial<Record<string, string>>;
  lat: number;
  lng: number;
  sitelinks: number;
  typeQid: string;
  imageFile: string | null;
}

interface SparqlResponse {
  results: { bindings: Record<string, { value: string } | undefined>[] };
}

const ENDPOINT = "https://query.wikidata.org/sparql";
const qidOf = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);

export function parsePoint(wkt: string): { lat: number; lng: number } | null {
  const m = wkt.match(/Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
  return m ? { lng: Number(m[1]), lat: Number(m[2]) } : null;
}

async function sparql(query: string): Promise<SparqlResponse> {
  return getJson<SparqlResponse>(`${ENDPOINT}?${qs({ query, format: "json" })}`, { accept: "application/sparql-results+json", timeoutMs: 45_000 });
}

function aroundQuery(lat: number, lng: number, radiusKm: number, types: string[], minSitelinks: number, limit: number): string {
  return `SELECT ?item ?label ?coord ?image ?sitelinks ?type WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" .
  }
  ?item wdt:P31 ?type .
  VALUES ?type { ${types.map((t) => `wd:${t}`).join(" ")} }
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${minSitelinks})
  OPTIONAL { ?item wdt:P18 ?image . }
  ?item rdfs:label ?label . FILTER(LANG(?label) = "en")
}
ORDER BY DESC(?sitelinks)
LIMIT ${limit}`;
}

/** Turns SPARQL rows into unique places (an item can have several types; the first listed wins). */
export function rowsToPlaces(res: SparqlResponse, typeOrder: string[]): WikidataPlace[] {
  const byItem = new Map<string, WikidataPlace>();
  for (const b of res.results.bindings) {
    const qid = b.item ? qidOf(b.item.value) : null;
    const point = b.coord ? parsePoint(b.coord.value) : null;
    const typeQid = b.type ? qidOf(b.type.value) : "";
    if (!qid || !point || !b.label?.value || /^Q\d+$/.test(b.label.value)) continue;
    const existing = byItem.get(qid);
    if (existing) {
      if (typeOrder.indexOf(typeQid) >= 0 && typeOrder.indexOf(typeQid) < typeOrder.indexOf(existing.typeQid)) existing.typeQid = typeQid;
      if (!existing.imageFile && b.image) existing.imageFile = fileFromCommonsUrl(b.image.value);
      continue;
    }
    byItem.set(qid, {
      qid,
      name: b.label.value,
      names: { en: b.label.value },
      lat: point.lat,
      lng: point.lng,
      sitelinks: Number(b.sitelinks?.value ?? 0),
      typeQid,
      imageFile: b.image ? fileFromCommonsUrl(b.image.value) : null,
    });
  }
  return [...byItem.values()].sort((a, b) => b.sitelinks - a.sitelinks);
}

/** Labels in every TRIPLAN language, so attraction names appear as they are known locally. */
async function addLabels(places: WikidataPlace[]): Promise<void> {
  if (!places.length) return;
  const langs = SITE_LANGS.filter((l) => l !== "en").map((l) => (l === "zh" ? ["zh-hans", "zh-cn", "zh"] : [l])).flat();
  const res = await sparql(`SELECT ?item ?label WHERE {
  VALUES ?item { ${places.map((p) => `wd:${p.qid}`).join(" ")} }
  ?item rdfs:label ?label .
  FILTER(LANG(?label) IN (${langs.map((l) => `"${l}"`).join(",")}))
}`);
  const byQid = new Map(places.map((p) => [p.qid, p]));
  for (const b of res.results.bindings) {
    const p = b.item ? byQid.get(qidOf(b.item.value)) : undefined;
    const label = b.label as ({ value: string; "xml:lang"?: string } | undefined);
    const lang = label?.["xml:lang"];
    if (!p || !label || !lang) continue;
    const key = lang.startsWith("zh") ? "zh" : lang;
    if (key === "zh" && p.names.zh && lang !== "zh-hans") continue; // prefer Simplified Chinese
    p.names[key] = label.value;
  }
}

export async function fetchAttractions(lat: number, lng: number, kind: string, limit = 24): Promise<WikidataPlace[]> {
  const types = Object.keys(ATTRACTION_TYPES);
  const radius = kind === "city" ? 8 : 25;
  let places = rowsToPlaces(await sparql(aroundQuery(lat, lng, radius, types, 6, 80)), types);
  if (places.length < 6) places = rowsToPlaces(await sparql(aroundQuery(lat, lng, radius * 2, types, 2, 80)), types);
  const top = places.slice(0, limit);
  await addLabels(top).catch(() => undefined);
  return top;
}

export async function fetchHubs(lat: number, lng: number): Promise<(WikidataPlace & { hub: "airport" | "rail" | "bus" })[]> {
  const out: (WikidataPlace & { hub: "airport" | "rail" | "bus" })[] = [];
  for (const hub of ["airport", "rail", "bus"] as const) {
    const types = Object.entries(HUB_TYPES).filter(([, v]) => v.hub === hub).map(([k]) => k);
    const { radiusKm, take } = HUB_TYPES[types[0]];
    const rows = rowsToPlaces(await sparql(aroundQuery(lat, lng, radiusKm, types, 3, 10)), types);
    for (const p of rows.slice(0, take)) out.push({ ...p, hub });
  }
  await addLabels(out).catch(() => undefined);
  return out;
}
