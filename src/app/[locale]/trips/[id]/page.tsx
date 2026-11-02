import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guards";
import { getTrip, getTripPlanning, type TripPlanning } from "@/lib/trips";
import { getDb, schema } from "@/db";
import { accommodationLinks, activityLinks, flightLinks, luggageLinks, transportLinks } from "@/lib/links";
import { withPartners } from "@/lib/affiliates";
import { TripWorkspace } from "@/components/itinerary/TripWorkspace";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trips" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function TripPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(`/trips/${id}`);
  const trip = await getTrip(id, user.id);
  if (!trip) notFound(); // also covers trips owned by someone else
  const db = await getDb();
  let center = { lat: 0, lng: 0 };
  let candidates: { id: string; destinationId: string; name: string; kind: string; neighborhood: string | null; verification: string }[] = [];
  // Every destination the trip visits (multi-city trips have several).
  const destinationIds = [...new Set([trip.destinationId, ...trip.days.map((d) => d.destinationId)].filter(Boolean) as string[])];
  if (trip.destinationId) {
    const [c] = await db.select({ lat: schema.cities.lat, lng: schema.cities.lng }).from(schema.destinations).innerJoin(schema.cities, eq(schema.cities.id, schema.destinations.cityId)).where(eq(schema.destinations.id, trip.destinationId));
    if (c) center = c;
    candidates = await db
      .select({ id: schema.places.id, destinationId: schema.places.destinationId, name: schema.places.name, kind: schema.places.kind, neighborhood: schema.places.neighborhood, verification: schema.places.verification })
      .from(schema.places)
      .where(and(inArray(schema.places.destinationId, destinationIds), inArray(schema.places.kind, ["attraction", "activity", "restaurant"])))
      .orderBy(asc(schema.places.name));
  }
  const [prefs] = await db.select({ timeFormat: schema.userPreferences.timeFormat, units: schema.userPreferences.units }).from(schema.userPreferences).where(eq(schema.userPreferences.userId, user.id));
  const adults = trip.adults || 1;
  let planning: TripPlanning = { suggestion: null, nearby: [], stayAreas: [] };
  try {
    planning = await getTripPlanning(trip, locale);
  } catch (err) {
    console.error("[trip] planning data unavailable", err);
  }
  const links = await withPartners(
    [
      ...accommodationLinks(trip.destinationName, trip.startDate, trip.endDate, adults),
      ...flightLinks(trip.destinationName, trip.departureCity, trip.startDate, trip.endDate),
      ...activityLinks(trip.destinationName),
      ...luggageLinks(trip.destinationName),
      ...transportLinks(trip.destinationName),
    ],
    { source: "trip", destination: trip.destinationSlug, city: trip.destinationName, checkin: trip.startDate, checkout: trip.endDate, adults, locale, lat: center.lat || null, lng: center.lng || null },
  );
  return (
    <TripWorkspace
      initialTrip={trip}
      candidates={candidates}
      center={center}
      initialPlanning={planning}
      externalLinks={links}
      timeFormat={prefs?.timeFormat ?? "auto"}
      units={prefs?.units ?? "metric"}
    />
  );
}
