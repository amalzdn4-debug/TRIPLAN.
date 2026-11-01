import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { pageMetadata } from "@/lib/seo";

const GROUPS = {
  planning: 3,
  accounts: 2,
  savedTrips: 2,
  payments: 3,
  languages: 2,
  maps: 2,
  bookings: 2,
  subscriptions: 2,
  privacy: 2,
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "faq" });
  return pageMetadata({ locale, path: "/faq", title: t("title"), description: t("lead") });
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("faq");
  const entries = Object.entries(GROUPS).flatMap(([g, n]) => Array.from({ length: n }, (_, i) => ({ q: t(`${g}.q${i + 1}`), a: t(`${g}.a${i + 1}`) })));
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: entries.map((e) => ({ "@type": "Question", name: e.q, acceptedAnswer: { "@type": "Answer", text: e.a } })) };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="page-header">
        <div className="container">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1>{t("title")}</h1>
          <p className="lead">{t("lead")}</p>
        </div>
      </header>
      <section className="section section--tight">
        <div className="container container--narrow faq">
          {Object.entries(GROUPS).map(([g, n]) => (
            <div key={g} id={g}>
              <h2>{t(`groups.${g}`)}</h2>
              {Array.from({ length: n }, (_, i) => (
                <details key={i}>
                  <summary>
                    {t(`${g}.q${i + 1}`)}
                    <Icon name="plus" />
                  </summary>
                  <div className="faq__answer">{t(`${g}.a${i + 1}`)}</div>
                </details>
              ))}
            </div>
          ))}
          <p style={{ marginBlockStart: 40 }}>
            {t("more")} <Link href="/contact">{t("contactUs")}</Link>
          </p>
        </div>
      </section>
    </>
  );
}
