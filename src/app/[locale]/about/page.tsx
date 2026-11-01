import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return pageMetadata({ locale, path: "/about", title: t("title"), description: t("lead") });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
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
        <div className="container grid grid--3">
          {(["mission", "purpose", "vision"] as const).map((k, i) => (
            <Reveal key={k} index={i} className="card stack">
              <div className="icon-tile"><Icon name={k === "mission" ? "compass" : k === "purpose" ? "route" : "globe"} /></div>
              <h2 style={{ fontSize: "var(--fs-lg)" }}>{t(`${k}.title`)}</h2>
              <p className="muted">{t(`${k}.body`)}</p>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="section section--white">
        <div className="container container--narrow prose">
          <h2>{t("principlesTitle")}</h2>
          <ul>
            {[1, 2, 3, 4, 5].map((n) => <li key={n}><strong>{t(`principle${n}.title`)}</strong> — {t(`principle${n}.body`)}</li>)}
          </ul>
          <h2>{t("nameTitle")}</h2>
          <p>{t("nameBody")}</p>
          <div className="cluster" style={{ marginBlockStart: 32 }}>
            <Link href="/plan" className="btn btn--primary">{t("cta")}</Link>
            <Link href="/contact" className="btn">{t("contact")}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
