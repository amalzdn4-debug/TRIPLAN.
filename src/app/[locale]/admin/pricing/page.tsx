import { getTranslations, setRequestLocale } from "next-intl/server";
import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminForm } from "@/components/admin/AdminForms";

export default async function AdminPricing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const db = await getDb();
  const plans = await db.select().from(schema.subscriptionPlans).orderBy(asc(schema.subscriptionPlans.sortOrder));
  return (
    <AdminShell current="/admin/pricing" title={t("sections.pricing")}>
      <p className="small muted">{t("pricingHelp")}</p>
      <p className="small muted">{t("pricingExisting")}</p>
      <div className="grid grid--3">
        {plans.map((p) => (
          <AdminForm key={p.id} kind="plan" submitLabel={t("save")}>
            <input type="hidden" name="id" value={p.id} />
            <p className="small muted ltr" style={{ margin: 0 }}>{p.id} · {p.billing}</p>
            <div className="field"><label>{t("planName")}</label><input name="name" className="input" defaultValue={p.name} /></div>
            <div className="form-row">
              <div className="field"><label>{t("price")}</label><input name="price" type="number" step="0.01" min="0" className="input" defaultValue={(p.priceCents / 100).toFixed(2)} disabled={p.id === "free"} /></div>
              <div className="field"><label>{t("currency")}</label><input name="currency" className="input" maxLength={3} defaultValue={p.currency} /></div>
            </div>
            {p.id === "free" ? <input type="hidden" name="price" value="0" /> : null}
            {p.id === "monthly" ? (
              <div className="field"><label>{t("tripsPerMonth")}</label><input name="tripsIncluded" type="number" min="1" max="100" className="input" defaultValue={p.tripsIncluded ?? 4} /></div>
            ) : null}
            <label className="checkbox"><input type="checkbox" name="active" defaultChecked={p.active} disabled={p.id === "free"} /><span>{t("active")}</span></label>
          </AdminForm>
        ))}
      </div>
    </AdminShell>
  );
}
