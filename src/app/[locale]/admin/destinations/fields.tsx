import { getTranslations } from "next-intl/server";

export interface DestValues {
  id?: string;
  slug?: string;
  city?: string;
  countryCode?: string;
  continent?: string;
  lat?: number;
  lng?: number;
  summary?: string;
  description?: string;
  bestTime?: string | null;
  daysMin?: number | null;
  daysMax?: number | null;
  budgetLevel?: string | null;
  contentStatus?: string;
  featured?: boolean;
  published?: boolean;
}

export async function DestinationFields({ v = {} }: { v?: DestValues }) {
  const t = await getTranslations("admin");
  return (
    <>
      {v.id ? <input type="hidden" name="id" value={v.id} /> : null}
      <div className="form-row">
        <div className="field"><label>{t("dest.city")}</label><input name="city" className="input" defaultValue={v.city} required /></div>
        <div className="field"><label>{t("dest.country")}</label><input name="countryCode" className="input" maxLength={2} defaultValue={v.countryCode} required /></div>
        <div className="field"><label>{t("dest.slug")}</label><input name="slug" className="input ltr" defaultValue={v.slug} required /></div>
        <div className="field"><label>{t("dest.continent")}</label>
          <select name="continent" className="select" defaultValue={v.continent ?? "europe"}>
            {["europe", "mena", "asia", "north_america", "south_america", "africa", "oceania"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="field"><label>{t("dest.lat")}</label><input name="lat" className="input ltr" defaultValue={v.lat} required /></div>
        <div className="field"><label>{t("dest.lng")}</label><input name="lng" className="input ltr" defaultValue={v.lng} required /></div>
        <div className="field"><label>{t("dest.daysMin")}</label><input name="daysMin" type="number" className="input" defaultValue={v.daysMin ?? 2} /></div>
        <div className="field"><label>{t("dest.daysMax")}</label><input name="daysMax" type="number" className="input" defaultValue={v.daysMax ?? 4} /></div>
      </div>
      <div className="field"><label>{t("dest.summary")}</label><input name="summary" className="input" defaultValue={v.summary} required maxLength={300} /></div>
      <div className="field"><label>{t("dest.description")}</label><textarea name="description" className="textarea" defaultValue={v.description} /></div>
      <div className="form-row">
        <div className="field"><label>{t("dest.bestTime")}</label><input name="bestTime" className="input" defaultValue={v.bestTime ?? ""} /></div>
        <div className="field"><label>{t("dest.budget")}</label>
          <select name="budgetLevel" className="select" defaultValue={v.budgetLevel ?? "mid"}>
            {["budget", "mid", "premium"].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="field"><label>{t("dest.contentStatus")}</label>
          <select name="contentStatus" className="select" defaultValue={v.contentStatus ?? "sample"}>
            <option value="sample">sample</option><option value="verified">verified</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="field"><label>{t("dest.imageUrl")}</label><input name="imageUrl" className="input ltr" placeholder="https://images.unsplash.com/…" /></div>
        <div className="field"><label>{t("dest.imageAlt")}</label><input name="imageAlt" className="input" /></div>
        <div className="field"><label>{t("dest.imageCredit")}</label><input name="imageCredit" className="input" /></div>
      </div>
      <div className="cluster">
        <label className="checkbox"><input type="checkbox" name="featured" defaultChecked={v.featured} /><span>{t("dest.featured")}</span></label>
        <label className="checkbox"><input type="checkbox" name="published" defaultChecked={v.published ?? true} /><span>{t("dest.published")}</span></label>
      </div>
    </>
  );
}
