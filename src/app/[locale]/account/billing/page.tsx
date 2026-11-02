import { getTranslations, setRequestLocale } from "next-intl/server";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guards";
import { getDb, schema } from "@/db";
import { getUsage } from "@/lib/entitlements";
import { features, stripeMode } from "@/lib/env";
import { SubscriptionControls } from "@/components/account/SubscriptionControls";
import { formatCents, formatDate } from "@/lib/format";
import { AccountNav } from "@/components/account/AccountNav";
import { Notice } from "@/components/ui/Form";
import { Link } from "@/i18n/navigation";
import { openBillingPortalAction } from "@/actions/billing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing" });
  return { title: t("title"), robots: { index: false } };
}

export default async function BillingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ checkout?: string; status?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser("/account/billing");
  const t = await getTranslations("billing");
  const sp = await searchParams;
  const db = await getDb();
  const usage = await getUsage(user.id);
  const payments = await db.select().from(schema.payments).where(eq(schema.payments.userId, user.id)).orderBy(desc(schema.payments.createdAt)).limit(50);
  const sub = usage.subscription;
  return (
    <section className="section" style={{ paddingBlockStart: "calc(var(--header-h) + 2.5rem)" }}>
      <div className="container dash-layout">
        <AccountNav current="/account/billing" isAdmin={user.role === "admin"} />
        <div className="stack" style={{ gap: 24 }}>
          <h1 style={{ fontSize: "var(--fs-2xl)" }}>{t("title")}</h1>
          {sp.checkout === "success" ? <Notice tone="success">{t("checkoutSuccess")}</Notice> : null}
          {sp.status === "unavailable" || !features.stripe() ? <Notice tone="warning">{t("unavailable")}</Notice> : null}
          {sp.status === "alreadySubscribed" ? <Notice>{t("alreadySubscribed")}</Notice> : null}
          {stripeMode() === "test" ? <Notice tone="warning">{t("testMode")}</Notice> : null}
          <div className="grid grid--3">
            <div className="card">
              <p className="small muted">{t("currentPlan")}</p>
              <h2 style={{ fontSize: "var(--fs-xl)" }}>{sub ? t(`planNames.${sub.planId}`) : t("free")}</h2>
              {sub ? (
                <>
                  <p className="small">
                    {sub.cancelAtPeriodEnd ? t("endsOn", { date: formatDate(sub.currentPeriodEnd?.toISOString(), locale) }) : t("renewsOn", { date: formatDate(sub.currentPeriodEnd?.toISOString(), locale) })}
                    {sub.status !== "active" ? ` · ${t("statusLabel", { status: sub.status })}` : ""}
                    {!sub.livemode ? <> · <span className="badge badge--alert">{t("test")}</span></> : null}
                  </p>
                  {features.stripe() ? <SubscriptionControls cancelAtPeriodEnd={sub.cancelAtPeriodEnd} endDate={formatDate(sub.currentPeriodEnd?.toISOString(), locale)} /> : null}
                </>
              ) : null}
            </div>
            <div className="card">
              {sub && sub.tripsIncluded != null ? (
                <>
                  <p className="small muted">{t("thisPeriod")}</p>
                  <h2 style={{ fontSize: "var(--fs-xl)" }}>{t("tripsUsedOf", { used: sub.tripsUsedInPeriod, total: sub.tripsIncluded })}</h2>
                  <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={sub.tripsIncluded} aria-valuenow={sub.tripsUsedInPeriod} aria-label={t("thisPeriod")}>
                    <span style={{ inlineSize: `${Math.min(100, (sub.tripsUsedInPeriod / Math.max(1, sub.tripsIncluded)) * 100)}%` }} />
                  </div>
                  <p className="small">{sub.cancelAtPeriodEnd ? t("periodEnds", { date: formatDate(sub.currentPeriodEnd?.toISOString(), locale) }) : t("resetsOn", { date: formatDate(sub.currentPeriodEnd?.toISOString(), locale) })}</p>
                </>
              ) : (
                <>
                  <p className="small muted">{t("tripsCreated")}</p>
                  <h2 style={{ fontSize: "var(--fs-xl)" }}>{usage.tripsCreated}</h2>
                  <p className="small">{sub ? t("unlimited") : t("freeRemaining", { n: usage.freeRemaining })}</p>
                </>
              )}
            </div>
            <div className="card">
              <p className="small muted">{t("credits")}</p>
              <h2 style={{ fontSize: "var(--fs-xl)" }}>{usage.credits}</h2>
              <Link href="/pricing" className="small">{t("buyMore")}</Link>
            </div>
          </div>
          <div className="cluster">
            <Link href="/pricing" className="btn btn--primary">{sub ? t("viewPlans") : t("upgrade")}</Link>
            {features.stripe() ? (
              <form action={openBillingPortalAction}>
                <button type="submit" className="btn">{t("manage")}</button>
              </form>
            ) : null}
          </div>
          <div>
            <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("history")}</h2>
            {payments.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>{t("date")}</th><th>{t("item")}</th><th>{t("amount")}</th><th>{t("status")}</th></tr></thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{formatDate(p.createdAt.toISOString(), locale)}</td>
                        <td>{t.has(`items.${p.planId}`) ? t(`items.${p.planId}`) : p.planId}{!p.livemode ? <> <span className="badge badge--alert">{t("test")}</span></> : null}</td>
                        <td className="ltr">{formatCents(p.amountCents, p.currency, locale)}</td>
                        <td><span className={`badge ${p.status === "paid" ? "badge--blue" : "badge--alert"}`}>{t(`paymentStatus.${p.status}`)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">{t("noPayments")}</p>
            )}
          </div>
          <p className="small muted">{t("cardNote")}</p>
        </div>
      </div>
    </section>
  );
}
