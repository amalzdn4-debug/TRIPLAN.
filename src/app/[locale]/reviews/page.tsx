import { getTranslations, setRequestLocale } from "next-intl/server";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { ReviewForm } from "@/components/community/ReviewForm";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reviews" });
  return pageMetadata({ locale, path: "/reviews", title: t("title"), description: t("lead") });
}

export default async function ReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("reviews");
  const user = await getCurrentUser();
  let reviews: { id: string; rating: number; body: string; createdAt: Date; author: string | null; locale: string }[] = [];
  let avg: number | null = null;
  try {
    const db = await getDb();
    reviews = await db
      .select({ id: schema.platformReviews.id, rating: schema.platformReviews.rating, body: schema.platformReviews.body, createdAt: schema.platformReviews.createdAt, author: schema.profiles.displayName, locale: schema.platformReviews.locale })
      .from(schema.platformReviews)
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.platformReviews.userId))
      .where(eq(schema.platformReviews.status, "published"))
      .orderBy(desc(schema.platformReviews.createdAt))
      .limit(100);
    const [a] = await db.select({ avg: sql<number | null>`avg(${schema.platformReviews.rating})::float` }).from(schema.platformReviews).where(eq(schema.platformReviews.status, "published"));
    avg = a?.avg ?? null;
  } catch {
    /* show empty state */
  }
  return (
    <>
      <header className="page-header">
        <div className="container">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1>{t("title")}</h1>
          <p className="lead">{t("lead")}</p>
          {avg != null && reviews.length ? <p className="small" style={{ marginBlockStart: 12 }}>{t("average", { avg: avg.toFixed(1), count: reviews.length })}</p> : null}
        </div>
      </header>
      <section className="section section--tight">
        <div className="container dest-layout">
          <div className="stack">
            {reviews.length ? (
              reviews.map((r) => (
                <article key={r.id} className="post" lang={r.locale}>
                  <div className="post__head">
                    <span className="avatar" aria-hidden>{(r.author ?? "T").slice(0, 1).toUpperCase()}</span>
                    <strong style={{ color: "var(--color-heading)" }}>{r.author ?? t("anonymous")}</strong>
                    <span>· {formatDate(r.createdAt.toISOString(), locale)}</span>
                  </div>
                  <span className="stars" aria-label={t("ratingLabel", { n: r.rating })}>
                    {Array.from({ length: 5 }, (_, i) => <Icon key={i} name="star" fill={i < r.rating ? "currentColor" : "none"} />)}
                  </span>
                  <p>{r.body}</p>
                </article>
              ))
            ) : (
              <div className="empty">
                <div className="icon-tile"><Icon name="star" /></div>
                <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("emptyTitle")}</h2>
                <p className="muted">{t("emptyBody")}</p>
              </div>
            )}
          </div>
          <aside className="dest-aside">
            {user ? (user.emailVerified ? <ReviewForm /> : <p className="card small">{t("verifyFirst")}</p>) : (
              <div className="card stack">
                <p className="small">{t("signInToReview")}</p>
                <Link href={{ pathname: "/login", query: { next: "/reviews" } }} className="btn btn--primary">{t("signIn")}</Link>
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
