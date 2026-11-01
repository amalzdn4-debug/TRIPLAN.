import { getTranslations, setRequestLocale } from "next-intl/server";
import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminForm } from "@/components/admin/AdminForms";
import { LOCALES, LOCALE_META } from "@/config/locales";

export default async function AdminTranslations({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const db = await getDb();
  const rows = await db.select().from(schema.translationRecords).orderBy(asc(schema.translationRecords.key), asc(schema.translationRecords.locale));
  return (
    <AdminShell current="/admin/translations" title={t("sections.translations")}>
      <p className="small muted">{t("translationsHelp")}</p>
      <AdminForm kind="translation" submitLabel={t("save")}>
        <div className="form-row">
          <div className="field"><label>{t("locale")}</label>
            <select name="locale" className="select">{LOCALES.map((l) => <option key={l} value={l}>{LOCALE_META[l].nativeName}</option>)}</select>
          </div>
          <div className="field"><label>{t("key")}</label><input name="key" className="input ltr" placeholder="home.hero.title" required /></div>
        </div>
        <div className="field"><label>{t("value")}</label><textarea name="value" className="textarea" /></div>
        <label className="checkbox"><input type="checkbox" name="reviewed" /><span>{t("reviewed")}</span></label>
      </AdminForm>
      {rows.length ? (
        <div className="table-wrap"><table className="table"><thead><tr><th>{t("key")}</th><th>{t("locale")}</th><th>{t("value")}</th><th>{t("reviewed")}</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.id}><td className="ltr">{r.key}</td><td>{r.locale}</td><td lang={r.locale} dir={LOCALE_META[r.locale as keyof typeof LOCALE_META]?.dir}>{r.value}</td><td>{r.reviewed ? "✓" : ""}</td></tr>)}
        </tbody></table></div>
      ) : <p className="muted">{t("noOverrides")}</p>}
    </AdminShell>
  );
}
