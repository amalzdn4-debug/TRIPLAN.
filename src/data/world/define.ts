/**
 * Compact definitions for the world destination catalogue.
 *
 * Each entry is an editorial SAMPLE (shown as "Unverified" until an editor verifies it in /admin).
 * Coordinates were checked against the GeoNames gazetteer (CC BY 4.0) — see scripts/check-world.ts.
 * The Wikipedia importer (src/lib/enrich) adds a longer introduction, licensed photos with
 * credits and the main attractions (from Wikidata) on the live site.
 */
import type { Climate, Continent, Experience, SeedDestination, TravelStyle } from "../destinations";

export type DestinationKind = "city" | "coastal" | "island" | "nature";

export interface WorldDestination extends SeedDestination {
  kind: DestinationKind;
  /** English Wikipedia article title used by the importer (defaults to the city name). */
  wiki: string;
}

/** Continent and local currency per ISO 3166-1 country code. */
export const COUNTRY_INFO: Record<string, { continent: Continent; currency: string }> = {
  // Europe
  FR: { continent: "europe", currency: "EUR" }, IT: { continent: "europe", currency: "EUR" }, PT: { continent: "europe", currency: "EUR" },
  ES: { continent: "europe", currency: "EUR" }, GB: { continent: "europe", currency: "GBP" }, NL: { continent: "europe", currency: "EUR" },
  DE: { continent: "europe", currency: "EUR" }, AT: { continent: "europe", currency: "EUR" }, GR: { continent: "europe", currency: "EUR" },
  CZ: { continent: "europe", currency: "CZK" }, TR: { continent: "europe", currency: "TRY" }, IE: { continent: "europe", currency: "EUR" },
  BE: { continent: "europe", currency: "EUR" }, LU: { continent: "europe", currency: "EUR" }, CH: { continent: "europe", currency: "CHF" },
  HU: { continent: "europe", currency: "HUF" }, PL: { continent: "europe", currency: "PLN" }, SK: { continent: "europe", currency: "EUR" },
  SI: { continent: "europe", currency: "EUR" }, HR: { continent: "europe", currency: "EUR" }, ME: { continent: "europe", currency: "EUR" },
  BA: { continent: "europe", currency: "BAM" }, RS: { continent: "europe", currency: "RSD" }, BG: { continent: "europe", currency: "BGN" },
  RO: { continent: "europe", currency: "RON" }, EE: { continent: "europe", currency: "EUR" }, LV: { continent: "europe", currency: "EUR" },
  LT: { continent: "europe", currency: "EUR" }, GE: { continent: "europe", currency: "GEL" }, DK: { continent: "europe", currency: "DKK" },
  SE: { continent: "europe", currency: "SEK" }, NO: { continent: "europe", currency: "NOK" }, FI: { continent: "europe", currency: "EUR" },
  IS: { continent: "europe", currency: "ISK" }, MT: { continent: "europe", currency: "EUR" }, CY: { continent: "europe", currency: "EUR" },
  // Middle East & North Africa
  AE: { continent: "mena", currency: "AED" }, LB: { continent: "mena", currency: "LBP" }, JO: { continent: "mena", currency: "JOD" },
  EG: { continent: "mena", currency: "EGP" }, MA: { continent: "mena", currency: "MAD" }, QA: { continent: "mena", currency: "QAR" },
  SA: { continent: "mena", currency: "SAR" }, OM: { continent: "mena", currency: "OMR" }, TN: { continent: "mena", currency: "TND" },
  DZ: { continent: "mena", currency: "DZD" }, BH: { continent: "mena", currency: "BHD" }, KW: { continent: "mena", currency: "KWD" },
  // Asia
  JP: { continent: "asia", currency: "JPY" }, KR: { continent: "asia", currency: "KRW" }, TH: { continent: "asia", currency: "THB" },
  SG: { continent: "asia", currency: "SGD" }, MY: { continent: "asia", currency: "MYR" }, ID: { continent: "asia", currency: "IDR" },
  HK: { continent: "asia", currency: "HKD" }, CN: { continent: "asia", currency: "CNY" }, TW: { continent: "asia", currency: "TWD" },
  MO: { continent: "asia", currency: "MOP" }, VN: { continent: "asia", currency: "VND" }, KH: { continent: "asia", currency: "USD" },
  LA: { continent: "asia", currency: "LAK" }, PH: { continent: "asia", currency: "PHP" }, IN: { continent: "asia", currency: "INR" },
  LK: { continent: "asia", currency: "LKR" }, NP: { continent: "asia", currency: "NPR" }, MV: { continent: "asia", currency: "MVR" },
  BT: { continent: "asia", currency: "BTN" }, UZ: { continent: "asia", currency: "UZS" }, AZ: { continent: "asia", currency: "AZN" },
  MN: { continent: "asia", currency: "MNT" },
  // North America (incl. Central America & Caribbean)
  US: { continent: "north_america", currency: "USD" }, CA: { continent: "north_america", currency: "CAD" }, MX: { continent: "north_america", currency: "MXN" },
  CU: { continent: "north_america", currency: "CUP" }, PR: { continent: "north_america", currency: "USD" }, DO: { continent: "north_america", currency: "DOP" },
  BS: { continent: "north_america", currency: "BSD" }, JM: { continent: "north_america", currency: "JMD" }, BB: { continent: "north_america", currency: "BBD" },
  CR: { continent: "north_america", currency: "CRC" }, PA: { continent: "north_america", currency: "USD" }, GT: { continent: "north_america", currency: "GTQ" },
  // South America
  BR: { continent: "south_america", currency: "BRL" }, AR: { continent: "south_america", currency: "ARS" }, PE: { continent: "south_america", currency: "PEN" },
  CL: { continent: "south_america", currency: "CLP" }, CO: { continent: "south_america", currency: "COP" }, EC: { continent: "south_america", currency: "USD" },
  BO: { continent: "south_america", currency: "BOB" }, UY: { continent: "south_america", currency: "UYU" },
  // Sub-Saharan Africa
  ZA: { continent: "africa", currency: "ZAR" }, KE: { continent: "africa", currency: "KES" }, TZ: { continent: "africa", currency: "TZS" },
  NA: { continent: "africa", currency: "NAD" }, BW: { continent: "africa", currency: "BWP" }, ZW: { continent: "africa", currency: "USD" },
  ZM: { continent: "africa", currency: "ZMW" }, RW: { continent: "africa", currency: "RWF" }, ET: { continent: "africa", currency: "ETB" },
  UG: { continent: "africa", currency: "UGX" }, GH: { continent: "africa", currency: "GHS" }, SN: { continent: "africa", currency: "XOF" },
  NG: { continent: "africa", currency: "NGN" }, MU: { continent: "africa", currency: "MUR" }, SC: { continent: "africa", currency: "SCR" },
  MG: { continent: "africa", currency: "MGA" }, CV: { continent: "africa", currency: "CVE" },
  // Oceania
  AU: { continent: "oceania", currency: "AUD" }, NZ: { continent: "oceania", currency: "NZD" }, FJ: { continent: "oceania", currency: "FJD" },
  PF: { continent: "oceania", currency: "XPF" }, CK: { continent: "oceania", currency: "NZD" },
};

const BUDGET = { b: "budget", m: "mid", p: "premium" } as const;

/** "4-6,9-10" → [4,5,6,9,10]; ranges may wrap the year ("11-3" → [11,12,1,2,3]). */
export function parseMonths(spec: string): number[] {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const [a, b = a] = part.split("-").map(Number);
    let m = a;
    for (let i = 0; i < 12; i++) {
      out.add(m);
      if (m === b) break;
      m = (m % 12) + 1;
    }
  }
  return [...out].sort((x, y) => x - y);
}

export function W(
  slug: string,
  city: string,
  country: string,
  lat: number,
  lng: number,
  tz: string,
  days: string,
  budget: keyof typeof BUDGET,
  climate: Climate,
  styles: string,
  experiences: string,
  months: string,
  popularity: number,
  summary: string,
  bestTime: string,
  opts: { kind?: DestinationKind; wiki?: string; featured?: boolean } = {},
): WorldDestination {
  const info = COUNTRY_INFO[country];
  if (!info) throw new Error(`Unknown country code ${country} for ${slug}`);
  const [dmin, dmax = dmin] = days.split("-").map(Number);
  return {
    slug,
    city,
    country,
    continent: info.continent,
    lat,
    lng,
    tz,
    summary,
    bestTime,
    bestMonths: parseMonths(months),
    days: [dmin, dmax],
    budget: BUDGET[budget],
    climate,
    styles: styles.split(",") as TravelStyle[],
    experiences: experiences.split(",") as Experience[],
    popularity,
    featured: opts.featured,
    kind: opts.kind ?? "city",
    wiki: opts.wiki ?? city,
  };
}
