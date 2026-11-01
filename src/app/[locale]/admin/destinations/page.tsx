import { getTranslations, setRequestLocale } from "next-intl/server";
import { asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Link } from "@/i18n/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { DestinationFields } from "./fields";
import { AdminForm } from "@/components/admin/AdminForms";

export default async function AdminDestinations({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const db = await getDb();
  const rows = await db
    .select({ id: schema.destinations.id, slug: schema.destinations.slug, city: schema.cities.name, country: schema.cities.countryCode, featured: schema.destinations.featured, published: schema.destinations.published, status: schema.destinations.contentStatus, places: sql<number>`(select count(*)::int from places p where p.destination_id = ${schema.destinations.id})` })
    .from(schema.destinations)
    .innerJoin(schema.cities, eq(schema.cities.id, schema.destinations.cityId))
    .orderBy(asc(schema.cities.name));
  return (
    <AdminShell current="/admin/destinations" title={t("sections.destinations")}>
      <div className="table-wrap"><table className="table"><thead><tr><th>{t("dest.city")}</th><th>{t("dest.slug")}</th><th>{t("dest.places")}</th><th>{t("status")}</th><th /></tr></thead><tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td><strong>{r.city}</strong> ({r.country})</td>
            <td className="ltr">{r.slug}</td>
            <td>{r.places}</td>
            <td className="cluster" style={{ gap: 4 }}>
              <span className={`badge ${r.status === "verified" ? "badge--blue" : "badge--outline"}`}>{r.status}</span>
              {r.featured ? <span className="badge badge--gold">{t("dest.featured")}</span> : null}
              {!r.published ? <span className="badge badge--alert">{t("dest.hidden")}</span> : null}
            </td>
            <td><Link href={`/admin/destinations/${r.id}`} className="btn btn--sm">{t("edit")}</Link></td>
          </tr>
        ))}
      </tbody></table></div>
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("dest.add")}</h2>
      <AdminForm kind="destination" submitLabel={t("dest.add")}><DestinationFields /></AdminForm>
    </AdminShell>
  );
}
