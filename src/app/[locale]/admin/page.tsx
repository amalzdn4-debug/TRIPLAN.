import { getTranslations, setRequestLocale } from "next-intl/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth/guards";
import { AdminShell } from "@/components/admin/AdminShell";
import { CommandButton } from "@/components/admin/AdminForms";
import { features, stripeMode } from "@/lib/env";
import { formatCents, formatDate } from "@/lib/format";
import { Notice } from "@/components/ui/Form";

export default async function AdminDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("admin");
  const db = await getDb();
  const n = sql<number>`count(*)::int`;
  const c = async (q: PromiseLike<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  const stats = [
    { label: t("stats.users"), value: await c(db.select({ n }).from(schema.users)) },
    { label: t("stats.trips"), value: await c(db.select({ n }).from(schema.trips)) },
    { label: t("stats.destinations"), value: await c(db.select({ n }).from(schema.destinations)) },
    { label: t("stats.places"), value: await c(db.select({ n }).from(schema.places)) },
    { label: t("stats.posts"), value: await c(db.select({ n }).from(schema.communityPosts)) },
    { label: t("stats.openReports"), value: await c(db.select({ n }).from(schema.reports).where(eq(schema.reports.status, "open"))) },
    // Real (live-mode) figures only: Stripe test-mode activity is shown separately and never counted.
    { label: t("stats.activeSubs"), value: await c(db.select({ n }).from(schema.subscriptions).where(and(eq(schema.subscriptions.status, "active"), eq(schema.subscriptions.livemode, true)))) },
    { label: t("stats.payments"), value: await c(db.select({ n }).from(schema.payments).where(and(eq(schema.payments.status, "paid"), eq(schema.payments.livemode, true)))) },
    { label: t("stats.affiliateClicks30"), value: await c(db.select({ n }).from(schema.affiliateClicks).where(sql`${schema.affiliateClicks.createdAt} > now() - interval '30 days'`)) },
  ];
  const revenue = await db
    .select({ currency: schema.payments.currency, cents: sql<number>`sum(${schema.payments.amountCents})::int` })
    .from(schema.payments)
    .where(and(eq(schema.payments.status, "paid"), eq(schema.payments.livemode, true)))
    .groupBy(schema.payments.currency);
  const testPayments = await c(db.select({ n }).from(schema.payments).where(eq(schema.payments.livemode, false)));
  const mode = stripeMode();
  const messages = await db.select().from(schema.contactMessages).where(eq(schema.contactMessages.handled, false)).orderBy(desc(schema.contactMessages.createdAt)).limit(20);
  const integrations = [
    { name: "AI (Anthropic)", on: features.ai() },
    { name: "Stripe", on: features.stripe() },
    { name: "Email (Resend)", on: features.email() },
    { name: "Google sign-in", on: features.googleAuth() },
    { name: "Google Routes", on: features.googleRoutes() },
    { name: t("integrationNames.uploads"), on: features.uploads() },
    { name: t("integrationNames.cron"), on: Boolean(process.env.CRON_SECRET) },
  ];
  return (
    <AdminShell current="/admin" title={t("sections.dashboard")}>
      {!features.email() ? <Notice tone="warning">{t("emailOffDashboard")}</Notice> : null}
      <div className="grid grid--4">
        {stats.map((s) => (
          <div key={s.label} className="card"><p className="small muted">{s.label}</p><p className="plan__price" style={{ fontSize: "var(--fs-2xl)" }}>{s.value}</p></div>
        ))}
      </div>
      <div className="card">
        <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("revenue")}</h2>
        <p style={{ margin: 0 }}>{revenue.length ? revenue.map((r) => formatCents(r.cents, r.currency, locale)).join(" · ") : formatCents(0, "EUR", locale)}</p>
        <p className="small muted" style={{ margin: 0 }}>{t("revenueNote")}{testPayments ? ` ${t("testPaymentsExcluded", { n: testPayments })}` : ""}</p>
        {mode === "test" ? <p className="small" style={{ margin: 0 }}><span className="badge badge--alert">{t("stripeTestMode")}</span></p> : null}
      </div>
      <div className="card">
        <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("integrations")}</h2>
        <div className="cluster">{integrations.map((i) => <span key={i.name} className={`badge ${i.on ? "badge--blue" : "badge--alert"}`}>{i.name}: {i.on ? t("configured") : t("notConfigured")}</span>)}</div>
      </div>
      <div>
        <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("inbox")}</h2>
        {messages.length ? (
          <div className="table-wrap"><table className="table"><thead><tr><th>{t("date")}</th><th>{t("from")}</th><th>{t("topic")}</th><th>{t("message")}</th><th /></tr></thead><tbody>
            {messages.map((m) => (
              <tr key={m.id}><td>{formatDate(m.createdAt.toISOString(), locale)}</td><td>{m.name}<br /><span className="ltr small">{m.email}</span></td><td>{m.topic}</td><td style={{ whiteSpace: "pre-wrap", maxInlineSize: 420 }}>{m.message}</td><td><CommandButton cmd={{ type: "contact", id: m.id, command: "handled" }} label={t("markHandled")} /></td></tr>
            ))}
          </tbody></table></div>
        ) : <p className="muted">{t("inboxEmpty")}</p>}
      </div>
    </AdminShell>
  );
}
