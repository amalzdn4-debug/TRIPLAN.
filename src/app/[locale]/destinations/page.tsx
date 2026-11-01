import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getDestinationCards } from "@/lib/destinations";
import { countryName } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { Reveal } from "@/components/ui/Reveal";

const ORDER = ["europe", "mena", "asia", "north_america", "south_america", "africa", "oceania"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "destinations" });
  return pageMetadata({ locale, path: "/destinations", title: t("title"), description: t("lead") });
}

/** A–Z directory of every supported destination, grouped by region. */
export default async function DestinationsIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("destinations");
  const te = await getTranslations("explore");
  const cards = await getDestinationCards(locale);
  return (
    <>
      <header className="page-header">
        <div className="container">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1>{t("title")}</h1>
          <p className="lead">{t("lead")}</p>
          <nav className="cluster" style={{ marginBlockStart: 24 }} aria-label={t("jump")}>
            {ORDER.filter((c) => cards.some((d) => d.continent === c)).map((c) => (
              <a key={c} href={`#${c}`} className="btn btn--sm">
                {te(`continents.${c}`)}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <section className="section section--tight">
        <div className="container stack" style={{ gap: 48 }}>
          {ORDER.map((c) => {
            const list = cards.filter((d) => d.continent === c).sort((a, b) => a.city.localeCompare(b.city, locale));
            if (!list.length) return null;
            return (
              <Reveal key={c} as="section" id={c} aria-labelledby={`h-${c}`}>
                <h2 id={`h-${c}`}>{te(`continents.${c}`)}</h2>
                <ul className="grid grid--4" style={{ listStyle: "none", padding: 0, gap: 12 }}>
                  {list.map((d) => (
                    <li key={d.slug}>
                      <Link href={`/destinations/${d.slug}`} className="card card--flat" style={{ display: "block", padding: 16, textDecoration: "none" }}>
                        <strong style={{ color: "var(--color-heading)" }}>{d.city}</strong>
                        <br />
                        <span className="small muted">{countryName(d.countryCode, locale)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            );
          })}
        </div>
      </section>
    </>
  );
}
