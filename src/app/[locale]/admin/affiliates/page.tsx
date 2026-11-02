import { getTranslations, setRequestLocale } from "next-intl/server";
import { asc, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminForm, CommandButton } from "@/components/admin/AdminForms";
import { PLACEHOLDERS } from "@/lib/affiliate-template";
import { formatDate } from "@/lib/format";

/**
 * Affiliate partners. A partner is shown on the site only when its status is "approved" —
 * set it only after the programme has actually accepted TRIPLAN. Commissions are tracked in the
 * partner's own dashboard; TRIPLAN only counts clicks.
 */
export default async function AdminAffiliates({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const db = await getDb();
  const partners = await db.select().from(schema.affiliatePartners).orderBy(asc(schema.affiliatePartners.status), asc(schema.affiliatePartners.sortOrder), asc(schema.affiliatePartners.name));
  const stats = await db
    .select({
      partnerId: schema.affiliateClicks.partnerId,
      d7: sql<number>`count(*) filter (where ${schema.affiliateClicks.createdAt} > now() - interval '7 days')::int`,
      d30: sql<number>`count(*) filter (where ${schema.affiliateClicks.createdAt} > now() - interval '30 days')::int`,
      visitors30: sql<number>`count(distinct ${schema.affiliateClicks.visitorHash}) filter (where ${schema.affiliateClicks.createdAt} > now() - interval '30 days')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(schema.affiliateClicks)
    .groupBy(schema.affiliateClicks.partnerId);
  const byId = new Map(stats.map((s) => [s.partnerId, s]));
  const fields = (p?: (typeof partners)[number]) => (
    <>
      {p ? <input type="hidden" name="id" value={p.id} /> : null}
      <div className="form-row">
        <div className="field"><label htmlFor={`n-${p?.id ?? "new"}`}>{t("aff.name")}</label><input id={`n-${p?.id ?? "new"}`} name="name" className="input" maxLength={80} required defaultValue={p?.name} /></div>
        <div className="field"><label htmlFor={`s-${p?.id ?? "new"}`}>{t("aff.slug")}</label><input id={`s-${p?.id ?? "new"}`} name="slug" className="input ltr" maxLength={41} required pattern="[a-z0-9][a-z0-9-]{1,40}" defaultValue={p?.slug} /></div>
        <div className="field">
          <label htmlFor={`c-${p?.id ?? "new"}`}>{t("aff.category")}</label>
          <select id={`c-${p?.id ?? "new"}`} name="category" className="select" defaultValue={p?.category ?? "accommodation"}>
            {schema.AFFILIATE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`aff.categories.${c}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor={`l-${p?.id ?? "new"}`}>{t("aff.template")}</label>
        <input id={`l-${p?.id ?? "new"}`} name="linkTemplate" className="input ltr" required defaultValue={p?.linkTemplate} placeholder="https://partner.example/search?aid=YOUR_ID&city={city}&checkin={checkin}" />
        <p className="field-hint">{t("aff.templateHint", { list: PLACEHOLDERS.map((x) => `{${x}}`).join(" ") })}</p>
      </div>
      <div className="form-row">
        <div className="field"><label htmlFor={`w-${p?.id ?? "new"}`}>{t("aff.website")}</label><input id={`w-${p?.id ?? "new"}`} name="websiteUrl" className="input ltr" defaultValue={p?.websiteUrl ?? ""} /></div>
        <div className="field"><label htmlFor={`o-${p?.id ?? "new"}`}>{t("aff.order")}</label><input id={`o-${p?.id ?? "new"}`} name="sortOrder" type="number" min="0" max="999" className="input" defaultValue={p?.sortOrder ?? 0} /></div>
      </div>
      <div className="field"><label htmlFor={`x-${p?.id ?? "new"}`}>{t("aff.notes")}</label><textarea id={`x-${p?.id ?? "new"}`} name="notes" className="textarea" maxLength={1000} defaultValue={p?.notes ?? ""} style={{ minBlockSize: 70 }} /></div>
    </>
  );
  return (
    <AdminShell current="/admin/affiliates" title={t("sections.affiliates")}>
      <p className="small muted">{t("aff.help")}</p>
      {partners.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t("aff.name")}</th><th>{t("aff.category")}</th><th>{t("aff.status")}</th><th>{t("aff.clicks7")}</th><th>{t("aff.clicks30")}</th><th>{t("aff.visitors30")}</th><th>{t("aff.total")}</th></tr></thead>
            <tbody>
              {partners.map((p) => {
                const st = byId.get(p.id);
                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong><br /><span className="small muted ltr">/api/go/{p.slug}</span></td>
                    <td>{t(`aff.categories.${p.category}`)}</td>
                    <td>
                      <span className={`badge ${p.status === "approved" ? "badge--blue" : p.status === "rejected" ? "badge--alert" : ""}`}>{t(`aff.statuses.${p.status}`)}</span>
                      {p.approvedAt ? <><br /><span className="small muted">{formatDate(p.approvedAt.toISOString(), locale)}</span></> : null}
                    </td>
                    <td>{st?.d7 ?? 0}</td>
                    <td>{st?.d30 ?? 0}</td>
                    <td>{st?.visitors30 ?? 0}</td>
                    <td>{st?.total ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">{t("aff.none")}</p>
      )}
      {partners.map((p) => (
        <details key={p.id} className="card">
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>{p.name} · {t(`aff.statuses.${p.status}`)}</summary>
          <div className="cluster" style={{ marginBlock: 12 }}>
            {p.status !== "approved" ? <CommandButton cmd={{ type: "affiliate", id: p.id, command: "approved" }} label={t("aff.approve")} confirmText={t("aff.confirmApprove", { name: p.name })} /> : null}
            {p.status === "approved" ? <CommandButton cmd={{ type: "affiliate", id: p.id, command: "paused" }} label={t("aff.pause")} /> : null}
            {p.status !== "rejected" ? <CommandButton cmd={{ type: "affiliate", id: p.id, command: "rejected" }} label={t("aff.reject")} /> : null}
            {p.status !== "pending" ? <CommandButton cmd={{ type: "affiliate", id: p.id, command: "pending" }} label={t("aff.markPending")} /> : null}
            <CommandButton cmd={{ type: "affiliate", id: p.id, command: "delete" }} label={t("aff.delete")} danger confirmText={t("aff.confirmDelete", { name: p.name })} />
          </div>
          <AdminForm kind="affiliate" submitLabel={t("save")}>{fields(p)}</AdminForm>
        </details>
      ))}
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("aff.add")}</h2>
      <AdminForm kind="affiliate" submitLabel={t("aff.addButton")}>{fields()}</AdminForm>
    </AdminShell>
  );
}
