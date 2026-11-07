import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/guards";
import { listTrips } from "@/lib/trips";
import { getUsage } from "@/lib/entitlements";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Form";
import { AccountNav } from "@/components/account/AccountNav";
import { pageMetadata } from "@/lib/seo";
import { features } from "@/lib/env";
import { ResendVerification } from "@/components/account/ResendVerification";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trips" });
  return pageMetadata({ locale, path: "/trips", title: t("title"), description: t("lead"), noindex: true });
}

const FILTERS = ["all", "upcoming", "drafts", "completed"] as const;

export default async function TripsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ filter?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser("/trips");
  const t = await getTranslations("trips");
  const { filter: raw } = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(raw ?? "") ? (raw as (typeof FILTERS)[number]) : "all";
  const [trips, usage] = await Promise.all([listTrips(user.id), getUsage(user.id)]);
  const today = new Date().toISOString().slice(0, 10);
  const shown = trips.filter((tr) => {
    if (filter === "upcoming") return tr.status !== "completed" && (tr.startDate ?? "") >= today;
    if (filter === "drafts") return tr.status === "draft";
    if (filter === "completed") return tr.status === "completed" || ((tr.endDate ?? "9999") < today && tr.status !== "draft");
    return true;
  });

  return (
    <section className="section" style={{ paddingBlockStart: "calc(var(--header-h) + 2.5rem)" }}>
      <div className="container dash-layout">
        <AccountNav current="/trips" isAdmin={user.role === "admin"} />
        <div className="stack" style={{ gap: 24 }}>
          <div className="section-head" style={{ marginBlockEnd: 0 }}>
            <div>
              <h1 style={{ fontSize: "var(--fs-2xl)" }}>{t("welcome", { name: user.displayName })}</h1>
              <p>{t("lead")}</p>
            </div>
            <Link href="/plan" className="btn btn--primary"><Icon name="plus" />{t("newTrip")}</Link>
          </div>
          {!user.emailVerified ? (
            <Notice tone="warning">
              {t("verifyEmail")} <ResendVerification available={features.emailDelivery()} />
            </Notice>
          ) : null}
          <div className="cluster small muted">
            {usage.admin ? (
              <span className="badge badge--navy">{t("adminUnlimited")}</span>
            ) : usage.subscription ? (
              <>
                <span className="badge badge--navy">{t("planActive", { plan: t(`planNames.${usage.subscription.planId}`) })}</span>
                {usage.subscription.tripsIncluded != null ? <span className="badge">{t("periodLeft", { n: Math.max(0, usage.subscription.tripsIncluded - usage.subscription.tripsUsedInPeriod) })}</span> : null}
              </>
            ) : (
              <>
                <span className="badge">{t("freeLeft", { n: usage.freeRemaining })}</span>
                <span className="badge">{t("credits", { n: usage.credits })}</span>
                <Link href="/pricing">{t("getMore")}</Link>
              </>
            )}
          </div>
          <nav className="tabs" aria-label={t("filterLabel")}>
            {FILTERS.map((f) => (
              <Link key={f} href={f === "all" ? "/trips" : { pathname: "/trips", query: { filter: f } }} aria-current={f === filter ? "page" : undefined}>
                {t(`filters.${f}`)}
              </Link>
            ))}
          </nav>
          {shown.length ? (
            <div className="grid grid--2">
              {shown.map((tr) => (
                <article key={tr.id} className="trip-card">
                  <div className="cluster" style={{ justifyContent: "space-between" }}>
                    <span className={`badge ${tr.status === "planned" ? "badge--blue" : tr.status === "completed" ? "badge--outline" : "badge--gold"}`}>{t(`status.${tr.status}`)}</span>
                    <span className="small muted">{t(`mode.${tr.mode}`)}</span>
                  </div>
                  <h3><Link href={`/trips/${tr.id}`}>{tr.title}</Link></h3>
                  <div className="meta-line">
                    <span><Icon name="pin" />{tr.destinationName}</span>
                    {tr.startDate ? <span><Icon name="calendar" />{formatDate(tr.startDate, locale)} – {formatDate(tr.endDate, locale)}</span> : null}
                    <span><Icon name="route" />{t("days", { n: tr.dayCount })}</span>
                  </div>
                  <span className="small muted">{t("updated", { date: formatDate(tr.updatedAt.toISOString(), locale) })}</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <div className="icon-tile"><Icon name="map" /></div>
              <h2 style={{ fontSize: "var(--fs-lg)" }}>{filter === "all" ? t("emptyTitle") : t("emptyFiltered")}</h2>
              <p className="muted">{t("emptyBody")}</p>
              <Link href="/plan" className="btn btn--primary">{t("planFirst")}</Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
