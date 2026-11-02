import { getTranslations, setRequestLocale } from "next-intl/server";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveSubscription } from "@/lib/entitlements";
import { features, stripeMode } from "@/lib/env";
import { formatCents, formatDate } from "@/lib/format";
import { startCheckoutAction } from "@/actions/billing";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/Form";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  return pageMetadata({ locale, path: "/pricing", title: t("title"), description: t("lead") });
}

const FALLBACK = [
  { id: "free", name: "Free", priceCents: 0, currency: "EUR", billing: "free", active: true, tripsIncluded: 1 },
  { id: "trip_pack", name: "Additional trip", priceCents: 299, currency: "EUR", billing: "one_time", active: true, tripsIncluded: 1 },
  { id: "monthly", name: "Monthly", priceCents: 699, currency: "EUR", billing: "monthly", active: true, tripsIncluded: 4 },
  { id: "annual", name: "Annual", priceCents: 2999, currency: "EUR", billing: "yearly", active: true, tripsIncluded: null },
];

export default async function PricingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ reason?: string; status?: string; checkout?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pricing");
  const sp = await searchParams;
  const user = await getCurrentUser();
  let plans = FALLBACK;
  try {
    const db = await getDb();
    const rows = await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.active, true)).orderBy(asc(schema.subscriptionPlans.sortOrder));
    if (rows.length) plans = rows;
  } catch {
    /* fallback shows configured defaults */
  }
  const sub = user ? await getActiveSubscription(user.id) : null;
  const stripe = features.stripe();
  const mode = stripeMode();

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
        <div className="container stack" style={{ gap: 28 }}>
          {sp.reason === "limit" ? <Notice tone="warning">{t("limitReached")}</Notice> : null}
          {sp.reason === "period_limit" && sub ? (
            <Notice tone="warning">{t("periodLimitReached", { n: sub.tripsIncluded ?? 0, date: formatDate(sub.currentPeriodEnd?.toISOString(), locale) })}</Notice>
          ) : null}
          {mode === "test" ? <Notice tone="warning">{t("testMode")}</Notice> : null}
          {sp.checkout === "cancelled" ? <Notice>{t("cancelled")}</Notice> : null}
          {sp.status === "unavailable" || !stripe ? <Notice tone="warning">{t("paymentsUnavailable")}</Notice> : null}
          <div className="pricing">
            {plans.map((p) => {
              const featured = p.id === "annual";
              const price = formatCents(p.priceCents, p.currency, locale);
              return (
                <article key={p.id} className={`plan ${featured ? "plan--featured" : ""}`}>
                  {featured ? <span className="badge badge--gold" style={{ alignSelf: "flex-start" }}>{t("bestValue")}</span> : null}
                  <h2>{t.has(`plans.${p.id}.name`) ? t(`plans.${p.id}.name`) : p.name}</h2>
                  <div className="plan__price">
                    {p.billing === "free" ? t("freePrice") : price}
                    <small> {p.billing === "yearly" ? t("perYear") : p.billing === "monthly" ? t("perMonth") : p.billing === "one_time" ? t("perTrip") : ""}</small>
                  </div>
                  <p className="small" style={{ opacity: 0.85 }}>{t.has(`plans.${p.id}.desc`) ? t(`plans.${p.id}.desc`, { n: p.tripsIncluded ?? 0 }) : null}</p>
                  <ul>
                    {[1, 2, 3, 4].map((n) => t.has(`plans.${p.id}.f${n}`) ? <li key={n}><Icon name="check" />{t(`plans.${p.id}.f${n}`, { n: p.tripsIncluded ?? 0 })}</li> : null)}
                  </ul>
                  {p.billing === "free" ? (
                    <Link href={user ? "/plan" : "/signup"} className="btn btn--block">{user ? t("startPlanning") : t("createAccount")}</Link>
                  ) : sub && (p.billing === "yearly" || p.billing === "monthly") ? (
                    <Link href="/account/billing" className="btn btn--gold btn--block">{sub.planId === p.id ? t("currentPlan") : t("manage")}</Link>
                  ) : (
                    <form action={startCheckoutAction}>
                      <input type="hidden" name="planId" value={p.id} />
                      <SubmitButton className={`btn btn--block ${featured ? "btn--gold" : "btn--primary"}`} disabled={!stripe}>
                        {p.billing === "yearly" || p.billing === "monthly" ? t("subscribe", { price }) : t("buy", { price })}
                      </SubmitButton>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
          <div className="card card--muted card--flat stack small">
            <strong>{t("transparencyTitle")}</strong>
            <ul style={{ margin: 0 }}>
              {[1, 2, 3, 4, 5].map((n) => <li key={n}>{t(`transparency${n}`)}</li>)}
            </ul>
            <p style={{ margin: 0 }}>
              <Link href="/legal/subscriptions">{t("policyLink")}</Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
