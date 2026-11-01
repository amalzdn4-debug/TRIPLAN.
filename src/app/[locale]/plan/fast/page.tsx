import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { getPlannerDestinations } from "@/lib/destinations";
import { countryName } from "@/lib/format";
import { features } from "@/lib/env";
import { FastTripForm } from "@/components/planner/FastTripForm";
import { EntitlementBanner } from "@/components/planner/EntitlementBanner";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "planner" });
  return pageMetadata({ locale, path: "/plan/fast", title: t("fastTitle"), description: t("fastLead"), noindex: true });
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function FastPlanPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ destination?: string; start?: string; end?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  const user = await requireUser(`/plan/fast${qs ? `?${qs}` : ""}`);
  const t = await getTranslations("planner");
  const dests = (await getPlannerDestinations(locale)).map((d) => ({ slug: d.slug, city: d.city, country: countryName(d.countryCode, locale), placeCount: d.placeCount }));
  return (
    <>
      <header className="page-header">
        <div className="container container--narrow">
          <span className="eyebrow">{t("fastEyebrow")}</span>
          <h1>{t("fastTitle")}</h1>
          <p className="lead">{t("fastLead")}</p>
        </div>
      </header>
      <section className="section section--tight">
        <div className="container container--narrow stack">
          <EntitlementBanner userId={user.id} />
          <FastTripForm
            destinations={dests}
            aiEnabled={features.ai()}
            defaults={{
              destination: sp.destination && dests.some((d) => d.slug === sp.destination) ? sp.destination : undefined,
              startDate: sp.start && DATE.test(sp.start) ? sp.start : undefined,
              endDate: sp.end && DATE.test(sp.end) ? sp.end : undefined,
              currency: user.currency,
            }}
          />
        </div>
      </section>
    </>
  );
}
