import { getTranslations, setRequestLocale } from "next-intl/server";
import { desc, eq, ilike, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/AdminShell";
import { CommandButton } from "@/components/admin/AdminForms";
import { formatDate } from "@/lib/format";

export default async function AdminUsers({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const me = await getCurrentUser();
  const { q } = await searchParams;
  const db = await getDb();
  const base = db
    .select({ id: schema.users.id, email: schema.users.email, role: schema.users.role, status: schema.users.status, verified: schema.users.emailVerifiedAt, createdAt: schema.users.createdAt, trips: sql<number>`(select count(*)::int from trips t where t.user_id = ${schema.users.id})`, name: schema.profiles.displayName })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id));
  const users = await (q ? base.where(ilike(schema.users.email, `%${q.replace(/[%_]/g, "")}%`)) : base).orderBy(desc(schema.users.createdAt)).limit(200);
  return (
    <AdminShell current="/admin/users" title={t("sections.users")}>
      <form method="get" className="cluster">
        <label className="visually-hidden" htmlFor="uq">{t("search")}</label>
        <input id="uq" name="q" className="input" defaultValue={q ?? ""} placeholder={t("searchEmail")} style={{ maxInlineSize: 320 }} />
        <button className="btn" type="submit">{t("search")}</button>
      </form>
      <div className="table-wrap"><table className="table"><thead><tr><th>{t("user")}</th><th>{t("role")}</th><th>{t("trips")}</th><th>{t("joined")}</th><th>{t("actions")}</th></tr></thead><tbody>
        {users.map((u) => (
          <tr key={u.id}>
            <td><strong>{u.name}</strong><br /><span className="small ltr">{u.email}</span> {u.verified ? "✓" : ""}</td>
            <td><span className="badge">{u.role}</span> {u.status === "suspended" ? <span className="badge badge--alert">{t("suspended")}</span> : null}</td>
            <td>{u.trips}</td>
            <td>{formatDate(u.createdAt.toISOString(), locale)}</td>
            <td>{u.id !== me?.id ? (
              <div className="cluster" style={{ gap: 4 }}>
                <CommandButton cmd={{ type: "user", id: u.id, command: u.role === "admin" ? "make_user" : "make_admin" }} label={u.role === "admin" ? t("removeAdmin") : t("makeAdmin")} confirmText={t("confirm")} />
                <CommandButton cmd={{ type: "user", id: u.id, command: u.status === "active" ? "suspend" : "activate" }} label={u.status === "active" ? t("suspend") : t("activate")} danger={u.status === "active"} confirmText={t("confirm")} />
              </div>
            ) : <span className="small muted">{t("you")}</span>}</td>
          </tr>
        ))}
      </tbody></table></div>
    </AdminShell>
  );
}
