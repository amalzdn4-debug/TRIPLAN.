import { getTranslations, setRequestLocale } from "next-intl/server";
import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminForm, CommandButton } from "@/components/admin/AdminForms";

export default async function AdminHero({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const db = await getDb();
  const slides = await db.select().from(schema.heroSlides).orderBy(asc(schema.heroSlides.sortOrder));
  const fields = (s?: (typeof slides)[number]) => (
    <>
      {s ? <input type="hidden" name="id" value={s.id} /> : null}
      <div className="form-row">
        <div className="field"><label>{t("hero.imageUrl")}</label><input name="imageUrl" className="input ltr" defaultValue={s?.imageUrl} required /></div>
        <div className="field"><label>{t("hero.alt")}</label><input name="alt" className="input" defaultValue={s?.alt} required /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>{t("hero.city")}</label><input name="city" className="input" defaultValue={s?.city} required /></div>
        <div className="field"><label>{t("hero.country")}</label><input name="countryCode" className="input" maxLength={2} defaultValue={s?.countryCode} required /></div>
        <div className="field"><label>{t("hero.slug")}</label><input name="destinationSlug" className="input" defaultValue={s?.destinationSlug ?? ""} /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>{t("hero.credit")}</label><input name="creditName" className="input" defaultValue={s?.creditName ?? ""} /></div>
        <div className="field"><label>{t("hero.creditUrl")}</label><input name="creditUrl" className="input ltr" defaultValue={s?.creditUrl ?? ""} /></div>
      </div>
    </>
  );
  return (
    <AdminShell current="/admin/hero" title={t("sections.hero")}>
      <p className="muted small">{t("hero.help")}</p>
      <div className="table-wrap"><table className="table"><thead><tr><th>#</th><th>{t("hero.image")}</th><th>{t("hero.city")}</th><th>{t("status")}</th><th>{t("actions")}</th></tr></thead><tbody>
        {slides.map((s, i) => (
          <tr key={s.id}>
            <td>{i + 1}</td>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <td><img className="thumb" src={s.imageUrl.replace("w=2400", "w=300")} alt={s.alt} /></td>
            <td><strong>{s.city}</strong> ({s.countryCode})<br /><span className="small muted">{s.creditName}</span></td>
            <td><span className={`badge ${s.enabled ? "badge--blue" : "badge--outline"}`}>{s.enabled ? t("enabled") : t("disabled")}</span></td>
            <td><div className="cluster" style={{ gap: 4 }}>
              <CommandButton cmd={{ type: "hero", id: s.id, command: "up" }} label="↑" />
              <CommandButton cmd={{ type: "hero", id: s.id, command: "down" }} label="↓" />
              <CommandButton cmd={{ type: "hero", id: s.id, command: "toggle" }} label={s.enabled ? t("disable") : t("enable")} />
              <CommandButton cmd={{ type: "hero", id: s.id, command: "delete" }} label={t("delete")} danger confirmText={t("confirmDelete")} />
            </div>
            <details style={{ marginBlockStart: 8 }}><summary className="small">{t("edit")}</summary><AdminForm kind="hero" submitLabel={t("save")}>{fields(s)}</AdminForm></details></td>
          </tr>
        ))}
      </tbody></table></div>
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("hero.add")}</h2>
      <AdminForm kind="hero" submitLabel={t("hero.add")}>{fields()}</AdminForm>
    </AdminShell>
  );
}
