import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { pageMetadata } from "@/lib/seo";
import { getPlannerDestinations } from "@/lib/destinations";
import { countryName } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth/session";
import { getUsage } from "@/lib/entitlements";
import { QuickStart } from "@/components/planner/QuickStart";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "planIntro" });
  return pageMetadata({ locale, path: "/plan", title: t("title"), description: t("lead") });
}

const SERVICES = [
  { key: "flights", icon: "plane" },
  { key: "hotels", icon: "bed" },
  { key: "restaurants", icon: "utensils" },
  { key: "activities", icon: "ticket" },
  { key: "luggage", icon: "luggage" },
  { key: "transport", icon: "car" },
] as const;

export default async function PlanPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("planIntro");
  const user = await getCurrentUser();
  const usage = user ? await getUsage(user.id) : null;
  const dests = (await getPlannerDestinations(locale)).map((d) => ({ ...d, country: countryName(d.countryCode, locale) }));

  return (
    <>
      <header className="page-header">
        <div className="container">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1>{t("title")}</h1>
          <p className="lead">{t("lead")}</p>
          <QuickStart destinations={dests} />
          {!user ? <p className="small muted" style={{ marginBlockStart: 12 }}>{t("accountNote")}</p> : null}
          {usage && !usage.subscription && usage.freeRemaining === 0 && usage.credits === 0 ? (
            <p className="small" style={{ marginBlockStart: 12 }}>
              {t("limitReached")} <Link href="/pricing">{t("seePricing")}</Link>
            </p>
          ) : null}
        </div>
      </header>

      <section className="section section--tight">
        <div className="container grid grid--2">
          <Reveal className="mode-card">
            <div className="icon-tile icon-tile--gold"><Icon name="sparkles" /></div>
            <h2 style={{ fontSize: "var(--fs-xl)" }}>{t("fastTitle")}</h2>
            <p className="muted">{t("fastBody")}</p>
            <ul>
              {[1, 2, 3].map((n) => <li key={n}><Icon name="check" />{t(`fastPoint${n}`)}</li>)}
            </ul>
            <Link href="/plan/fast" className="btn btn--primary btn--lg">{t("fastCta")}</Link>
          </Reveal>
          <Reveal className="mode-card mode-card--dark" index={1}>
            <div className="icon-tile icon-tile--gold"><Icon name="settings" /></div>
            <h2 style={{ fontSize: "var(--fs-xl)" }}>{t("detailedTitle")}</h2>
            <p>{t("detailedBody")}</p>
            <ul>
              {[1, 2, 3].map((n) => <li key={n}><Icon name="check" />{t(`detailedPoint${n}`)}</li>)}
            </ul>
            <Link href="/plan/detailed" className="btn btn--gold btn--lg">{t("detailedCta")}</Link>
          </Reveal>
        </div>
      </section>

      <section className="section section--white" id="services">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">{t("servicesEyebrow")}</span>
              <h2>{t("servicesTitle")}</h2>
              <p>{t("servicesLead")}</p>
            </div>
          </div>
          <div className="grid grid--3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.key} index={i % 3} className="card" id={s.key} style={{ scrollMarginTop: "calc(var(--header-h) + 24px)" }}>
                <div className="icon-tile" style={{ marginBlockEnd: 16 }}><Icon name={s.icon} /></div>
                <h3>{t(`services.${s.key}.title`)}</h3>
                <p className="muted small">{t(`services.${s.key}.body`)}</p>
                <span className="badge badge--outline">{t(`services.${s.key}.how`)}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
