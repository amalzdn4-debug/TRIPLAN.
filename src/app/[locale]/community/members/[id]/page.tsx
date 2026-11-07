import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMemberProfile } from "@/lib/community";
import { getCurrentUser } from "@/lib/auth/session";
import { Avatar, PostCard } from "@/components/community/PostCard";
import { Icon } from "@/components/ui/Icon";
import { formatDateTime } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "community" });
  const m = await getMemberProfile(id);
  return { title: m?.name || t("member"), robots: { index: false, follow: true } };
}

/** Public member profile. Shows only what the member chose to share; never the email address. */
export default async function MemberPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("community");
  const m = await getMemberProfile(id);
  if (!m) notFound();
  const me = await getCurrentUser();
  return (
    <>
      <header className="page-header">
        <div className="container member-head">
          <Avatar name={m.name} url={m.avatar} />
          <div>
            <h1>{m.name || t("member")}</h1>
            <p className="small muted" style={{ margin: 0 }}>
              {m.homeCity ? <><Icon name="home" style={{ display: "inline", inlineSize: 14, verticalAlign: -2 }} /> {m.homeCity} · </> : null}
              {t("memberSince", { date: formatDateTime(m.memberSince, locale, { month: "long", year: "numeric" }) })} · {t("postsN", { n: m.posts.length })} · {t("commentsN", { n: m.commentCount })}
            </p>
            {m.bio ? <p className="lead" style={{ marginBlockStart: 12 }}>{m.bio}</p> : null}
            {me?.id === m.id ? <Link href="/account" className="btn btn--sm" style={{ marginBlockStart: 12 }}><Icon name="edit" />{t("editProfile")}</Link> : null}
          </div>
        </div>
      </header>
      <section className="section section--tight">
        <div className="container container--narrow stack" style={{ gap: 20 }}>
          {m.posts.length ? (
            m.posts.map((p) => <PostCard key={p.id} post={p} signedIn={!!me} />)
          ) : (
            <div className="empty">
              <div className="icon-tile"><Icon name="users" /></div>
              <p className="muted">{t("memberNoPosts")}</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
