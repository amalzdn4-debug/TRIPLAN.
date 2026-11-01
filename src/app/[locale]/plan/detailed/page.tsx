import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { getPlannerDestinations } from "@/lib/destinations";
import { countryName } from "@/lib/format";
import { features } from "@/lib/env";
import { getDb, schema } from "@/db";
import { SEED_DESTINATIONS } from "@/data/destinations";
import { DetailedTripWizard } from "@/components/planner/DetailedTripWizard";
import { EntitlementBanner } from "@/components/planner/EntitlementBanner";
import { pageMetadata } from "@/lib/seo";
import { eq } from "drizzle-orm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "planner" });
  return pageMetadata({ locale, path: "/plan/detailed", title: t("detailedTitle"), description: t("detailedLead"), noindex: true });
}

export default async function DetailedPlanPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ destination?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const user = await requireUser(`/plan/detailed${sp.destination ? `?destination=${encodeURIComponent(sp.destination)}` : ""}`);
  const t = await getTranslations("planner");
  const base = await getPlannerDestinations(locale);
  let coords: { slug: string; lat: number; lng: number }[];
  try {
    const db = await getDb();
    coords = await db.select({ slug: schema.destinations.slug, lat: schema.cities.lat, lng: schema.cities.lng }).from(schema.destinations).innerJoin(schema.cities, eq(schema.cities.id, schema.destinations.cityId));
  } catch {
    coords = SEED_DESTINATIONS.map((d) => ({ slug: d.slug, lat: d.lat, lng: d.lng }));
  }
  const bySlug = new Map(coords.map((c) => [c.slug, c]));
  const dests = base.map((d) => ({ slug: d.slug, city: d.city, country: countryName(d.countryCode, locale), placeCount: d.placeCount, lat: bySlug.get(d.slug)?.lat ?? 0, lng: bySlug.get(d.slug)?.lng ?? 0 }));
  return (
    <>
      <header className="page-header">
        <div className="container">
          <span className="eyebrow">{t("detailedEyebrow")}</span>
          <h1>{t("detailedTitle")}</h1>
          <p className="lead">{t("detailedLead")}</p>
        </div>
      </header>
      <section className="section section--tight">
        <div className="container stack">
          <EntitlementBanner userId={user.id} />
          <DetailedTripWizard destinations={dests} aiEnabled={features.ai()} defaults={{ destination: sp.destination && dests.some((d) => d.slug === sp.destination) ? sp.destination : undefined, currency: user.currency }} />
        </div>
      </section>
    </>
  );
}
