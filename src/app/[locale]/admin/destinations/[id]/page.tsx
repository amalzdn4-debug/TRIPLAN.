import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminForm, CommandButton } from "@/components/admin/AdminForms";
import { admissionOf, type Admission } from "@/lib/admission";
import { DestinationFields } from "../fields";
import { Link } from "@/i18n/navigation";
import { sizedUrl } from "@/lib/images";

export default async function AdminDestination({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await getTranslations("admin");
  const db = await getDb();
  const [row] = await db
    .select({ d: schema.destinations, c: schema.cities, continent: schema.countries.continent })
    .from(schema.destinations)
    .innerJoin(schema.cities, eq(schema.cities.id, schema.destinations.cityId))
    .innerJoin(schema.countries, eq(schema.countries.code, schema.cities.countryCode))
    .where(eq(schema.destinations.id, id));
  if (!row) notFound();
  const places = await db.select().from(schema.places).where(eq(schema.places.destinationId, id)).orderBy(asc(schema.places.kind), asc(schema.places.name));
  const photos = await db.select().from(schema.destinationImages).where(eq(schema.destinationImages.destinationId, id)).orderBy(asc(schema.destinationImages.sortOrder));
  const d = row.d;
  return (
    <AdminShell current="/admin/destinations" title={`${row.c.name}`}>
      <Link href={`/destinations/${d.slug}`} className="small">{t("dest.viewPublic")}</Link>
      <AdminForm kind="destination" submitLabel={t("save")}>
        <DestinationFields v={{ id: d.id, slug: d.slug, city: row.c.name, countryCode: row.c.countryCode, continent: row.continent, lat: row.c.lat, lng: row.c.lng, summary: d.summary, description: d.description, bestTime: d.bestTime, daysMin: d.suggestedDaysMin, daysMax: d.suggestedDaysMax, budgetLevel: d.budgetLevel, contentStatus: d.contentStatus, featured: d.featured, published: d.published, kind: d.kind, wikiTitle: d.wikiTitle }} />
      </AdminForm>
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("photos.title")} ({photos.length})</h2>
      {photos.length ? (
        <div className="admin-photos">
          {photos.map((ph, i) => (
            <figure key={ph.id} className="admin-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sizedUrl(ph.url, "thumb")} alt={ph.alt} loading="lazy" />
              <figcaption className="small">
                {i === 0 ? <span className="badge badge--blue">{t("photos.cover")}</span> : <CommandButton cmd={{ type: "photo", id: ph.id, command: "cover" }} label={t("photos.makeCover")} />}
                <span className="muted"> {ph.creditName ?? ""}{ph.license ? ` · ${ph.license}` : ""}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="muted">{t("photos.none")}</p>
      )}
      <div className="cluster"><CommandButton cmd={{ type: "enrich", id: d.slug, command: "reimport" }} label={t("photos.fetch")} /></div>
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("places.title")} ({places.length})</h2>
      <div className="table-wrap"><table className="table"><thead><tr><th>{t("places.name")}</th><th>{t("places.kind")}</th><th>{t("places.coords")}</th><th>{t("status")}</th><th /></tr></thead><tbody>
        {places.map((p) => (
          <tr key={p.id}>
            <td>
              <strong>{p.name}</strong><br /><span className="small muted">{p.neighborhood} {p.tags.join(", ")}</span>
              {p.kind === "attraction" || p.kind === "activity" ? <AdmissionEditor placeId={p.id} admission={admissionOf(p.details)} t={t} /> : null}
            </td>
            <td>{t(`placeKinds.${p.kind}`)}</td>
            <td className="ltr small">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</td>
            <td><span className={`badge ${p.verification === "verified" ? "badge--blue" : "badge--outline"}`}>{t(`verificationStates.${p.verification}`)}</span></td>
            <td><div className="cluster" style={{ gap: 4 }}>
              <CommandButton cmd={{ type: "place", id: p.id, command: p.verification === "verified" ? "unverify" : "verify" }} label={p.verification === "verified" ? t("places.unverify") : t("places.verify")} />
              <CommandButton cmd={{ type: "place", id: p.id, command: "delete" }} label={t("delete")} danger confirmText={t("confirmDelete")} />
            </div></td>
          </tr>
        ))}
      </tbody></table></div>
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("places.add")}</h2>
      <p className="small muted">{t("places.help")}</p>
      <AdminForm kind="place" submitLabel={t("places.add")}>
        <input type="hidden" name="destinationId" value={d.id} />
        <div className="form-row">
          <div className="field"><label>{t("places.name")}</label><input name="name" className="input" required /></div>
          <div className="field"><label>{t("places.kind")}</label>
            <select name="kind" className="select">{["attraction", "activity", "restaurant", "accommodation", "luggage_storage", "transport_hub"].map((k) => <option key={k} value={k}>{t(`placeKinds.${k}`)}</option>)}</select>
          </div>
          <div className="field"><label>{t("places.verification")}</label>
            <select name="verification" className="select"><option value="verified">{t("verificationStates.verified")}</option><option value="sample">{t("verificationStates.sample")}</option></select>
          </div>
        </div>
        <div className="form-row">
          <div className="field"><label>{t("dest.lat")}</label><input name="lat" className="input ltr" required /></div>
          <div className="field"><label>{t("dest.lng")}</label><input name="lng" className="input ltr" required /></div>
          <div className="field"><label>{t("places.neighborhood")}</label><input name="neighborhood" className="input" /></div>
          <div className="field"><label>{t("places.duration")}</label><input name="durationMin" type="number" className="input" defaultValue={90} /></div>
        </div>
        <div className="form-row">
          <div className="field"><label>{t("places.tags")}</label><input name="tags" className="input" placeholder="museums, history" /></div>
          <div className="field"><label>{t("places.cuisine")}</label><input name="cuisine" className="input" /></div>
          <div className="field"><label>{t("places.dietary")}</label><input name="dietaryTags" className="input" placeholder="halal, vegetarian" /></div>
        </div>
        <div className="form-row">
          <div className="field"><label>{t("places.address")}</label><input name="address" className="input" /></div>
          <div className="field"><label>{t("places.website")}</label><input name="websiteUrl" className="input ltr" /></div>
          <div className="field"><label>{t("places.booking")}</label><input name="bookingUrl" className="input ltr" /></div>
          <div className="field"><label>{t("places.source")}</label><input name="source" className="input" /></div>
        </div>
      </AdminForm>
    </AdminShell>
  );
}

/** Admission for one place: free / paid / optional extras / free on certain days, with the official source. */
function AdmissionEditor({ placeId, admission, t }: { placeId: string; admission: Admission | null; t: (k: string, v?: Record<string, string | number>) => string }) {
  const a = admission?.basis === "editor" ? admission : null;
  return (
    <details className="admission-editor">
      <summary className="small">
        {t("admission.label")}: {admission ? t(`admission.types.${admission.type}`) : t("admission.types.unknown")}
        {admission?.basis === "public_space" ? ` (${t("admission.publicSpace")})` : a?.checked ? ` · ${t("admission.checked", { month: a.checked })}` : ""}
      </summary>
      <AdminForm kind="admission" submitLabel={t("admission.save")}>
        <input type="hidden" name="placeId" value={placeId} />
        <div className="form-row">
          <div className="field"><label htmlFor={`adm-type-${placeId}`}>{t("admission.type")}</label>
            <select id={`adm-type-${placeId}`} name="type" className="select" defaultValue={a?.type ?? "unknown"}>
              {(["unknown", "free", "paid", "optional", "conditional"] as const).map((k) => <option key={k} value={k}>{t(`admission.types.${k}`)}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor={`adm-price-${placeId}`}>{t("admission.price")}</label><input id={`adm-price-${placeId}`} name="priceAmount" type="number" step="0.01" min={0} className="input" defaultValue={a?.price?.amount ?? ""} /></div>
          <div className="field"><label htmlFor={`adm-cur-${placeId}`}>{t("admission.currency")}</label><input id={`adm-cur-${placeId}`} name="priceCurrency" className="input ltr" maxLength={3} placeholder="EUR" defaultValue={a?.price?.currency ?? ""} /></div>
        </div>
        <div className="field"><label htmlFor={`adm-free-${placeId}`}>{t("admission.freeWhen")}</label><input id={`adm-free-${placeId}`} name="freeWhen" className="input" defaultValue={a?.freeWhen ?? ""} placeholder={t("admission.freeWhenHint")} /></div>
        <div className="field"><label htmlFor={`adm-note-${placeId}`}>{t("admission.note")}</label><input id={`adm-note-${placeId}`} name="note" className="input" defaultValue={a?.note ?? ""} /></div>
        <label className="checkbox"><input type="checkbox" name="bookingRequired" defaultChecked={a?.bookingRequired} /><span>{t("admission.booking")}</span></label>
        <div className="field"><label htmlFor={`adm-src-${placeId}`}>{t("admission.source")}</label><input id={`adm-src-${placeId}`} name="source" className="input ltr" type="url" placeholder="https://" defaultValue={a?.source ?? ""} /></div>
        <p className="small muted">{t("admission.help")}</p>
      </AdminForm>
    </details>
  );
}
