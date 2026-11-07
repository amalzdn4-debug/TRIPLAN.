/**
 * Airport → city transfers, curated by hand from each operator's or airport's own website.
 *
 * Only TYPICAL journey times are stored (as a range) — never timetables or prices, which change.
 * Every option links to the official page where travellers check today's times and fares.
 * `checked` is when the figures were last compared with the official source.
 *
 * Airports that aren't listed still get help in the plan: distance, an estimated time and live
 * Google Maps directions to the accommodation — clearly labelled as such.
 */

export type TransferMode = "train" | "metro" | "tram" | "bus" | "boat";

export interface TransferPoint {
  name: string;
  lat: number;
  lng: number;
}

export interface AirportTransferOption {
  mode: TransferMode;
  /** Service name as the operator writes it (proper noun, not translated). */
  service: string;
  to: TransferPoint;
  /** Typical journey time range in minutes, from the official source. */
  minutes: [number, number];
  url: string;
}

export interface AirportInfo {
  iata: string;
  name: string;
  lat: number;
  lng: number;
  /** Destination slugs this airport serves (used for quick picks in the planner). */
  serves: string[];
  options: AirportTransferOption[];
  checked: string;
}

const P = (name: string, lat: number, lng: number): TransferPoint => ({ name, lat, lng });

const MILANO_CENTRALE = P("Milano Centrale", 45.4862, 9.2045);
const ROMA_TERMINI = P("Roma Termini", 41.901, 12.5016);

export const AIRPORTS: AirportInfo[] = [
  {
    iata: "MXP",
    name: "Milan Malpensa Airport",
    lat: 45.6306,
    lng: 8.7281,
    serves: ["milan"],
    options: [
      // trenord.it / malpensaexpress.it: about 51–54 min to Centrale (≈1 h from T2), 37–44 min to Cadorna.
      { mode: "train", service: "Malpensa Express", to: MILANO_CENTRALE, minutes: [51, 60], url: "https://www.malpensaexpress.it/en/" },
      { mode: "train", service: "Malpensa Express", to: P("Milano Cadorna", 45.4683, 9.1757), minutes: [37, 44], url: "https://www.malpensaexpress.it/en/" },
    ],
    checked: "2026-11",
  },
  {
    iata: "LIN",
    name: "Milan Linate Airport",
    lat: 45.4451,
    lng: 9.2767,
    serves: ["milan"],
    options: [
      // Metro M4 (blue line): about 12 min from Linate Aeroporto to San Babila.
      { mode: "metro", service: "M4", to: P("San Babila", 45.4664, 9.1984), minutes: [12, 15], url: "https://www.atm.it/en/" },
    ],
    checked: "2026-11",
  },
  {
    iata: "BGY",
    name: "Milan Bergamo Airport (Orio al Serio)",
    lat: 45.6739,
    lng: 9.7042,
    serves: ["milan", "bergamo"],
    options: [
      // Direct coaches to Milano Centrale (Terravision ≈50 min, Autostradale ≈1 h).
      { mode: "bus", service: "Airport coach", to: MILANO_CENTRALE, minutes: [50, 60], url: "https://www.milanbergamoairport.it/en/" },
    ],
    checked: "2026-11",
  },
  {
    iata: "FCO",
    name: "Rome Fiumicino Airport",
    lat: 41.7999,
    lng: 12.2462,
    serves: ["rome"],
    options: [
      // Trenitalia: non-stop, 32 minutes.
      { mode: "train", service: "Leonardo Express", to: ROMA_TERMINI, minutes: [32, 32], url: "https://www.trenitalia.com/en/services/leonardo-express.html" },
    ],
    checked: "2026-11",
  },
  {
    iata: "CIA",
    name: "Rome Ciampino Airport",
    lat: 41.7994,
    lng: 12.5949,
    serves: ["rome"],
    options: [
      // Direct airport buses to Termini ≈40 min (traffic-dependent).
      { mode: "bus", service: "Airport bus", to: ROMA_TERMINI, minutes: [40, 50], url: "https://www.adr.it/" },
    ],
    checked: "2026-11",
  },
  {
    iata: "VCE",
    name: "Venice Marco Polo Airport",
    lat: 45.5053,
    lng: 12.3519,
    serves: ["venice"],
    options: [
      // veneziaairport.it: ATVO 20 min, ACTV 23 min to Piazzale Roma; Alilaguna Rialto 57 min, San Marco 1 h 12.
      { mode: "bus", service: "ATVO", to: P("Piazzale Roma", 45.438, 12.3184), minutes: [20, 25], url: "https://www.veneziaairport.it/en/transport/venice.html" },
      { mode: "boat", service: "Alilaguna", to: P("Rialto", 45.438, 12.3359), minutes: [57, 60], url: "https://www.veneziaairport.it/en/transport/venice.html" },
      { mode: "boat", service: "Alilaguna", to: P("San Marco", 45.4328, 12.3376), minutes: [72, 75], url: "https://www.veneziaairport.it/en/transport/venice.html" },
    ],
    checked: "2026-11",
  },
  {
    iata: "NAP",
    name: "Naples International Airport (Capodichino)",
    lat: 40.886,
    lng: 14.2908,
    serves: ["naples"],
    options: [
      // ANM Alibus: ≈20 min to Piazza Garibaldi (Napoli Centrale), ≈35 min to Molo Beverello.
      { mode: "bus", service: "Alibus", to: P("Napoli Centrale (Piazza Garibaldi)", 40.853, 14.2722), minutes: [15, 25], url: "https://www.anm.it/" },
      { mode: "bus", service: "Alibus", to: P("Molo Beverello", 40.8379, 14.2547), minutes: [35, 45], url: "https://www.anm.it/" },
    ],
    checked: "2026-11",
  },
  {
    iata: "FLR",
    name: "Florence Airport (Peretola)",
    lat: 43.81,
    lng: 11.2051,
    serves: ["florence"],
    options: [
      // Tram T2: ≈20 min to Santa Maria Novella, 22 min to Unità.
      { mode: "tram", service: "T2", to: P("Firenze Santa Maria Novella", 43.7764, 11.2479), minutes: [20, 22], url: "https://www.gestramvia.com/" },
    ],
    checked: "2026-11",
  },
  {
    iata: "BLQ",
    name: "Bologna Guglielmo Marconi Airport",
    lat: 44.5354,
    lng: 11.2887,
    serves: ["bologna"],
    options: [
      // marconiexpress.it: about 7 min 30 s.
      { mode: "train", service: "Marconi Express", to: P("Bologna Centrale", 44.5058, 11.343), minutes: [7, 8], url: "https://www.marconiexpress.it/en/" },
    ],
    checked: "2026-11",
  },
  {
    iata: "CDG",
    name: "Paris Charles de Gaulle Airport",
    lat: 49.0097,
    lng: 2.5479,
    serves: ["paris"],
    options: [
      // parisaeroport.fr: ≈25 min Gare du Nord, ≈28 min Châtelet-Les-Halles (IDFM: 25–30).
      { mode: "train", service: "RER B", to: P("Paris Gare du Nord", 48.8809, 2.3553), minutes: [25, 30], url: "https://www.parisaeroport.fr/en/passengers/access/paris-charles-de-gaulle/public-transport/rer-b" },
      { mode: "train", service: "RER B", to: P("Châtelet-Les Halles", 48.8619, 2.347), minutes: [28, 35], url: "https://www.parisaeroport.fr/en/passengers/access/paris-charles-de-gaulle/public-transport/rer-b" },
    ],
    checked: "2026-11",
  },
  {
    iata: "LHR",
    name: "London Heathrow Airport",
    lat: 51.47,
    lng: -0.4543,
    serves: ["london"],
    options: [
      // heathrowexpress.com: 15 min from Heathrow Central, 21 min from T5; Elizabeth line ≈27 min.
      { mode: "train", service: "Heathrow Express", to: P("London Paddington", 51.5154, -0.1755), minutes: [15, 21], url: "https://www.heathrowexpress.com/" },
      { mode: "train", service: "Elizabeth line", to: P("London Paddington", 51.5154, -0.1755), minutes: [27, 30], url: "https://tfl.gov.uk/" },
    ],
    checked: "2026-11",
  },
  {
    iata: "BCN",
    name: "Barcelona–El Prat Airport",
    lat: 41.2974,
    lng: 2.0833,
    serves: ["barcelona"],
    options: [
      // TMB: airport buses and trains reach the centre in 30–40 min; Aerobús runs to Plaça de Catalunya.
      { mode: "bus", service: "Aerobús", to: P("Plaça de Catalunya", 41.387, 2.17), minutes: [30, 40], url: "https://aerobusbcn.com/" },
    ],
    checked: "2026-11",
  },
];

/** The curated airport within ~4 km of a point (e.g. an airport picked from the address search). */
export function findAirport(p: { lat: number; lng: number } | null | undefined): AirportInfo | null {
  if (!p) return null;
  let best: AirportInfo | null = null;
  let bestD = Infinity;
  for (const a of AIRPORTS) {
    const d = Math.hypot((a.lat - p.lat) * 111, (a.lng - p.lng) * 111 * Math.cos((p.lat * Math.PI) / 180));
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return bestD <= 4 ? best : null;
}

export function airportsServing(slug: string | null | undefined): AirportInfo[] {
  return slug ? AIRPORTS.filter((a) => a.serves.includes(slug)) : [];
}
