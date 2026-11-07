import { NextResponse } from "next/server";
import { geocode, type GeocodeKind } from "@/lib/geocode";
import { rateLimit } from "@/lib/rate-limit";

const KINDS = new Set<GeocodeKind>(["address", "airport", "station"]);

/** Address suggestions as you type. Public (the planner works before sign-in), cached and rate-limited. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 200);
  const kind = (u.searchParams.get("kind") ?? "address") as GeocodeKind;
  if (q.length < 3 || !KINDS.has(kind)) return NextResponse.json({ results: [] });
  if (!(await rateLimit("geocode", 60, 60_000))) return NextResponse.json({ error: "rateLimited", results: [] }, { status: 429 });
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const near = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && u.searchParams.has("lat") ? { lat, lng } : null;
  const results = await geocode(q, { kind, lang: u.searchParams.get("lang") ?? undefined, near });
  if (!results) return NextResponse.json({ error: "unavailable", results: [] }, { status: 503 });
  return NextResponse.json({ results }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
