import { getTranslations, setRequestLocale } from "next-intl/server";
import { asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Link } from "@/i18n/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { DestinationFields } from "./fields";
import { AdminForm, CommandButton, EnrichPanel } from "@/components/admin/AdminForms";

// The content-import button runs for up to ~40 s.
export const maxDuration = 60;

export default async function AdminDestinations({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams?: Promise<{ photos?: string }> }) {
  const { locale } = await params;
  const onlyMissing = (await searchParams)?.photos === "missing";
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const db = await getDb();
  const rows = await db
    .select({ id: schema.destinations.id, slug: schema.destinations.slug, city: schema.cities.name, country: schema.cities.countryCode, featured: schema.destinations.featured, published: schema.destinations.published, status: schema.destinations.contentStatus, enrichment: schema.destinations.enrichmentStatus, enrichmentError: schema.destinations.enrichmentError, places: sql<number>`(select count(*)::int from places p where p.destination_id = ${schema.destinations.id})`, photos: sql<number>`(select count(*)::int from destination_images i where i.destination_id = ${schema.destinations.id})`, placePhotos: sql<number>`(select count(*)::int from places p where p.destination_id = ${schema.destinations.id} and p.image_url is not null)` })
    .from(schema.destinations)
    .innerJoin(schema.cities, eq(schema.cities.id, schema.destinations.cityId))
    .orderBy(asc(schema.cities.name));
  const count = (s: string) => rows.filter((r) => r.enrichment === s).length;
  // "No photo" = no gallery photo and no attraction photo to fall back on (the card shows the placeholder).
  const missing = rows.filter((r) => r.published && Number(r.photos) === 0 && Number(r.placePhotos) === 0);
  const shown = onlyMissing ? missing : rows;
  return (
    <AdminShell current="/admin/destinations" title={t("sections.destinations")}>
      <EnrichPanel pending={count("pending")} done={count("done")} partial={count("partial")} failed={count("failed")} />
      <nav className="cluster" style={{ gap: 6 }} aria-label={t("photos.filter")}>
        <Link href="/admin/destinations" className="pick-chip" aria-current={!onlyMissing ? "true" : undefined}>{t("photos.all", { n: rows.length })}</Link>
        <Link href="/admin/destinations?photos=missing" className="pick-chip" aria-current={onlyMissing ? "true" : undefined}>{t("photos.missing", { n: missing.length })}</Link>
      </nav>
      {onlyMissing ? <p className="small muted">{t("photos.missingHelp")}</p> : null}
      <div className="table-wrap"><table className="table"><thead><tr><th>{t("dest.city")}</th><th>{t("dest.slug")}</th><th>{t("dest.places")}</th><th>{t("photos.column")}</th><th>{t("status")}</th><th>{t("enrich.column")}</th><th /></tr></thead><tbody>
        {shown.map((r) => (
          <tr key={r.id}>
            <td><strong>{r.city}</strong> ({r.country})</td>
            <td className="ltr">{r.slug}</td>
            <td>{r.places}</td>
            <td>{Number(r.photos) || (Number(r.placePhotos) ? <span className="small muted">{t("photos.fromPlaces", { n: Number(r.placePhotos) })}</span> : <span className="badge badge--alert">0</span>)}</td>
            <td className="cluster" style={{ gap: 4 }}>
              <span className={`badge ${r.status === "verified" ? "badge--blue" : "badge--outline"}`}>{r.status}</span>
              {r.featured ? <span className="badge badge--gold">{t("dest.featured")}</span> : null}
              {!r.published ? <span className="badge badge--alert">{t("dest.hidden")}</span> : null}
            </td>
            <td>
              <span className={`badge ${r.enrichment === "done" ? "badge--blue" : r.enrichment === "failed" ? "badge--alert" : "badge--outline"}`} title={r.enrichmentError ?? undefined}>{t(`enrich.status.${r.enrichment}`)}</span>
              {r.enrichmentError ? <p className="small muted" style={{ maxInlineSize: 280 }}>{r.enrichmentError.slice(0, 140)}</p> : null}
            </td>
            <td className="cluster" style={{ gap: 4 }}>
              <Link href={`/admin/destinations/${r.id}`} className="btn btn--sm">{t("edit")}</Link>
              <CommandButton cmd={{ type: "enrich", id: r.slug, command: "reimport" }} label={t("enrich.reimport")} />
            </td>
          </tr>
        ))}
      </tbody></table></div>
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("dest.add")}</h2>
      <AdminForm kind="destination" submitLabel={t("dest.add")}><DestinationFields /></AdminForm>
    </AdminShell>
  );
}
