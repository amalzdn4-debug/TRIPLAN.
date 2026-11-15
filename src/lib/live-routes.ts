import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { features } from "@/lib/env";
import type { TravelMode } from "@/lib/geo";

/**
 * Live travel times from Google Maps Platform (Routes API, "Compute Routes Essentials": point to
 * point, no traffic model, no waypoints).
 *
 * Google's terms: Routes content may not be stored or cached, and may only be shown on a Google map
 * or — as here — in a list with "Google Maps" attribution. So results go straight to the browser
 * and are never written to the database. Only the number of calls is counted, so the site stops at
 * the owner's monthly limit (GOOGLE_ROUTES_MONTHLY_LIMIT, default 9,500 — under the 10,000 free
 * calls) and falls back to its own estimates.
 */
const SERVICE = "google_routes";
const ROUTES_MODE: Record<TravelMode, string> = { walking: "WALK", transit: "TRANSIT", driving: "DRIVE", cycling: "BICYCLE" };
export const MAX_LEGS_PER_DAY = 14;

export interface LegRequest {
  /** The stop the leg starts from. */
  stopId: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  mode: TravelMode;
}

export interface LiveLeg {
  stopId: string;
  minutes: number;
  meters: number | null;
}

export type LiveResult = { status: "ok"; legs: LiveLeg[] } | { status: "off" | "limit" | "unavailable" };

export function monthlyLimit(): number {
  const n = Number(process.env.GOOGLE_ROUTES_MONTHLY_LIMIT);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 9500;
}

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

/** Calls used this month (for the admin dashboard). */
export async function routesUsage(): Promise<{ used: number; limit: number; month: string }> {
  const db = await getDb();
  const month = monthKey();
  const [row] = await db.select({ calls: schema.apiUsage.calls }).from(schema.apiUsage).where(and(eq(schema.apiUsage.service, SERVICE), eq(schema.apiUsage.month, month)));
  return { used: row?.calls ?? 0, limit: monthlyLimit(), month };
}

/** Atomically reserves `n` calls in this month's budget; false when it would pass the limit. */
export async function reserveCalls(n: number): Promise<boolean> {
  if (n <= 0) return true;
  const limit = monthlyLimit();
  if (n > limit) return false;
  const db = await getDb();
  const rows = await db.execute(sql`
    INSERT INTO api_usage (service, month, calls) VALUES (${SERVICE}, ${monthKey()}, ${n})
    ON CONFLICT (service, month) DO UPDATE SET calls = api_usage.calls + ${n}, updated_at = now()
    WHERE api_usage.calls + ${n} <= ${limit}
    RETURNING calls`);
  const list = Array.isArray(rows) ? rows : ((rows as unknown as { rows?: unknown[] }).rows ?? []);
  return list.length > 0;
}

async function computeOne(leg: LegRequest, fetchImpl: typeof fetch): Promise<LiveLeg | null> {
  try {
    const res = await fetchImpl("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY as string,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: leg.from.lat, longitude: leg.from.lng } } },
        destination: { location: { latLng: { latitude: leg.to.lat, longitude: leg.to.lng } } },
        travelMode: ROUTES_MODE[leg.mode],
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { routes?: { duration?: string; distanceMeters?: number }[] };
    const r = data.routes?.[0];
    if (!r?.duration) return null; // e.g. no public transport at this hour: keep our estimate
    return { stopId: leg.stopId, minutes: Math.max(1, Math.round(parseInt(r.duration, 10) / 60)), meters: r.distanceMeters ?? null };
  } catch {
    return null;
  }
}

/** Fetches live legs (never stored). Counts calls against the monthly limit first. */
export async function liveLegs(legs: LegRequest[], fetchImpl: typeof fetch = fetch): Promise<LiveResult> {
  if (!features.googleRoutes()) return { status: "off" };
  const wanted = legs.slice(0, MAX_LEGS_PER_DAY);
  if (!wanted.length) return { status: "ok", legs: [] };
  if (!(await reserveCalls(wanted.length))) return { status: "limit" };
  const out = (await Promise.all(wanted.map((l) => computeOne(l, fetchImpl)))).filter(Boolean) as LiveLeg[];
  return out.length ? { status: "ok", legs: out } : { status: "unavailable" };
}
