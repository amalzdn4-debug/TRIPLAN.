/**
 * Admission for places to visit — free, paid, optional paid extras, or free on certain days.
 *
 * Never assumed: a museum is NOT taken to need a ticket. Information comes from two places only:
 *  1. an editor's entry in Admin (with the official source link and the month it was checked);
 *  2. public spaces that are free by nature (squares, bridges, public fountains, statues, historic
 *     districts — by their Wikidata type). Parks, gardens, churches and monuments are NOT included:
 *     some of them charge.
 * Everything else is "unknown" and the site says "check the official website".
 */
export type AdmissionType = "free" | "paid" | "optional" | "conditional";

export interface Admission {
  type: AdmissionType;
  /** Standard adult price, only when the editor entered it from the official source. */
  price?: { amount: number; currency: string } | null;
  /** e.g. "reduced price for EU citizens 18–25" */
  note?: string | null;
  /** For "conditional": when entry is free, e.g. "first Sunday of the month". */
  freeWhen?: string | null;
  bookingRequired?: boolean;
  /** Official page the information comes from (required for editor entries). */
  source?: string | null;
  /** "YYYY-MM" the editor checked it. */
  checked?: string | null;
  /** How we know: an editor's verified entry, or a public space that is free by nature. */
  basis: "editor" | "public_space";
}

/** Wikidata types that are public spaces, free to visit by nature. */
export const PUBLIC_SPACE_TYPES = new Set(["Q174782" /* square */, "Q12280" /* bridge */, "Q483453" /* fountain */, "Q179700" /* statue */, "Q15243209" /* historic district */]);

const TYPES = new Set<AdmissionType>(["free", "paid", "optional", "conditional"]);

/** The admission we can state for a place, or null when it isn't known. */
export function admissionOf(details: unknown): Admission | null {
  const d = (details ?? {}) as { admission?: Partial<Admission> & { type?: string }; wikidataType?: string };
  const a = d.admission;
  if (a && a.type && TYPES.has(a.type as AdmissionType) && typeof a.source === "string" && /^https:\/\//.test(a.source)) {
    const price = a.price && Number.isFinite(Number(a.price.amount)) && /^[A-Z]{3}$/.test(String(a.price.currency)) ? { amount: Number(a.price.amount), currency: String(a.price.currency) } : null;
    return { type: a.type as AdmissionType, price: a.type === "free" ? null : price, note: a.note ?? null, freeWhen: a.freeWhen ?? null, bookingRequired: Boolean(a.bookingRequired), source: a.source, checked: a.checked ?? null, basis: "editor" };
  }
  if (d.wikidataType && PUBLIC_SPACE_TYPES.has(d.wikidataType)) return { type: "free", basis: "public_space" };
  return null;
}

/** "Prefer free activities": nudges the planner, never excludes places (unknown stays neutral). */
export function admissionScore(pref: "any" | "prefer_free" | null | undefined, a: AdmissionType | null | undefined): number {
  if (pref !== "prefer_free" || !a) return 0;
  return a === "free" ? 2 : a === "conditional" ? 0.75 : a === "optional" ? 1 : -1.5;
}
