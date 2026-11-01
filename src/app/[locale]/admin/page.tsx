import { getTranslations, setRequestLocale } from "next-intl/server";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth/guards";
import { AdminShell } from "@/components/admin/AdminShell";
import { CommandButton } from "@/components/admin/AdminForms";
import { features } from "@/lib/env";
import { formatDate } from "@/lib/format";

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
    { label: t("stats.activeSubs"), value: await c(db.select({ n }).from(schema.subscriptions).where(eq(schema.subscriptions.status, "active"))) },
    { label: t("stats.payments"), value: await c(db.select({ n }).from(schema.payments).where(eq(schema.payments.status, "paid"))) },
  ];
  const messages = await db.select().from(schema.contactMessages).where(eq(schema.contactMessages.handled, false)).orderBy(desc(schema.contactMessages.createdAt)).limit(20);
  const integrations = [
    { name: "AI (Anthropic)", on: features.ai() },
    { name: "Stripe", on: features.stripe() },
    { name: "Email (Resend)", on: features.email() },
    { name: "Google sign-in", on: features.googleAuth() },
    { name: "Google Routes", on: features.googleRoutes() },
  ];
  return (
    <AdminShell current="/admin" title={t("sections.dashboard")}>
      <div className="grid grid--4">
        {stats.map((s) => (
          <div key={s.label} className="card"><p className="small muted">{s.label}</p><p className="plan__price" style={{ fontSize: "var(--fs-2xl)" }}>{s.value}</p></div>
        ))}
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
