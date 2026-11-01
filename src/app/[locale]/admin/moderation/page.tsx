import { getTranslations, setRequestLocale } from "next-intl/server";
import { desc, eq, inArray, or, gt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminShell } from "@/components/admin/AdminShell";
import { CommandButton } from "@/components/admin/AdminForms";
import { formatDate } from "@/lib/format";

export default async function AdminModeration({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const db = await getDb();
  const posts = await db
    .select({ p: schema.communityPosts, author: schema.users.email, slug: schema.destinations.slug })
    .from(schema.communityPosts)
    .innerJoin(schema.users, eq(schema.users.id, schema.communityPosts.userId))
    .innerJoin(schema.destinations, eq(schema.destinations.id, schema.communityPosts.destinationId))
    .where(or(inArray(schema.communityPosts.status, ["pending", "hidden"]), gt(schema.communityPosts.reportCount, 0)))
    .orderBy(desc(schema.communityPosts.reportCount), desc(schema.communityPosts.createdAt))
    .limit(100);
  const reports = await db.select().from(schema.reports).where(eq(schema.reports.status, "open"));
  const reviews = await db.select({ r: schema.platformReviews, author: schema.users.email }).from(schema.platformReviews).innerJoin(schema.users, eq(schema.users.id, schema.platformReviews.userId)).where(eq(schema.platformReviews.status, "pending")).orderBy(desc(schema.platformReviews.createdAt));
  return (
    <AdminShell current="/admin/moderation" title={t("sections.moderation")}>
      <p className="small muted">{t("moderationHelp")}</p>
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("postsQueue")} ({posts.length})</h2>
      {posts.length ? posts.map(({ p, author, slug }) => (
        <article key={p.id} className="post">
          <div className="post__head">
            <span className="badge">{p.status}</span>
            <span className="badge badge--alert">{t("reports", { n: p.reportCount })}</span>
            <span className="small ltr">{author}</span>
            <span className="small">· {slug} · {formatDate(p.createdAt.toISOString(), locale)}</span>
          </div>
          <h3>{p.title}</h3>
          <p>{p.body}</p>
          {reports.filter((r) => r.postId === p.id).map((r) => <p key={r.id} className="small muted">⚑ {r.reason}{r.details ? `: ${r.details}` : ""}</p>)}
          <div className="cluster">
            <CommandButton cmd={{ type: "post", id: p.id, command: "published" }} label={t("publish")} />
            <CommandButton cmd={{ type: "post", id: p.id, command: "hidden" }} label={t("hide")} />
            <CommandButton cmd={{ type: "post", id: p.id, command: "removed" }} label={t("remove")} danger />
          </div>
        </article>
      )) : <p className="muted">{t("queueEmpty")}</p>}
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("reviewsQueue")} ({reviews.length})</h2>
      {reviews.length ? reviews.map(({ r, author }) => (
        <article key={r.id} className="post">
          <div className="post__head"><span>{"★".repeat(r.rating)}</span><span className="small ltr">{author}</span></div>
          <p>{r.body}</p>
          <div className="cluster">
            <CommandButton cmd={{ type: "review", id: r.id, command: "published" }} label={t("publish")} />
            <CommandButton cmd={{ type: "review", id: r.id, command: "hidden" }} label={t("hide")} danger />
          </div>
        </article>
      )) : <p className="muted">{t("queueEmpty")}</p>}
    </AdminShell>
  );
}
