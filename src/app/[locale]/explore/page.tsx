import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExploreClient } from "@/components/destinations/ExploreClient";
import { getDestinationCards } from "@/lib/destinations";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "explore" });
  return pageMetadata({ locale, path: "/explore", title: t("title"), description: t("lead") });
}

export default async function ExplorePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("explore");
  const destinations = await getDestinationCards(locale);
  return (
    <>
      <header className="page-header">
        <div className="container">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1>{t("title")}</h1>
          <p className="lead">{t("lead")}</p>
        </div>
      </header>
      <section className="section section--tight">
        <div className="container">
          <ExploreClient destinations={destinations} initial={{ continent: sp.continent ?? "", style: sp.style ?? "", q: sp.q ?? "" }} />
        </div>
      </section>
    </>
  );
}
