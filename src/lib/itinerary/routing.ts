import "server-only";
import { features } from "@/lib/env";
import type { PlannedStop } from "./types";

const ROUTES_MODE = { walking: "WALK", transit: "TRANSIT", driving: "DRIVE", cycling: "BICYCLE" } as const;

/**
 * Replaces estimated legs with real durations from Google Maps Platform (Routes API) when
 * GOOGLE_MAPS_API_KEY is configured. Failures leave the estimate in place (and labelled).
 */
export async function refineLegs(stops: PlannedStop[]): Promise<PlannedStop[]> {
  if (!features.googleRoutes()) return stops;
  const out = stops.map((s) => ({ ...s }));
  await Promise.all(
    out.map(async (s, i) => {
      const next = out[i + 1];
      if (!next || !s.travelMode || s.lat == null || s.lng == null || next.lat == null || next.lng == null) return;
      if (s.travelMeters != null && s.travelMeters < 60) return; // same spot
      if (s.kind === "transport" || next.kind === "transport") return; // station transfers are fixed estimates
      try {
        const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY as string,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
          },
          body: JSON.stringify({
            origin: { location: { latLng: { latitude: s.lat, longitude: s.lng } } },
            destination: { location: { latLng: { latitude: next.lat, longitude: next.lng } } },
            travelMode: ROUTES_MODE[s.travelMode],
          }),
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { routes?: { duration?: string; distanceMeters?: number }[] };
        const r = data.routes?.[0];
        if (!r?.duration) return;
        s.travelMinutes = Math.max(1, Math.round(parseInt(r.duration, 10) / 60));
        s.travelMeters = r.distanceMeters ?? s.travelMeters;
        s.travelSource = "provider";
      } catch {
        /* keep estimate */
      }
    }),
  );
  return out;
}
