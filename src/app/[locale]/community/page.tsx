import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPosts, POST_TYPES } from "@/lib/community";
import { getDestinationCards } from "@/lib/destinations";
import { getCurrentUser } from "@/lib/auth/session";
import { countryName } from "@/lib/format";
import { PostCard } from "@/components/community/PostCard";
import { PostForm } from "@/components/community/PostForm";
import { Notice } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { ResendVerification } from "@/components/account/ResendVerification";
import { pageMetadata } from "@/lib/seo";
import { features } from "@/lib/env";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "community" });
  return pageMetadata({ locale, path: "/community", title: t("title"), description: t("lead") });
}

const TYPES: string[] = [...POST_TYPES];

export default async function CommunityPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ destination?: string; type?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("community");
  const user = await getCurrentUser();
  const cards = await getDestinationCards(locale);
  const dests = cards.map((c) => ({ slug: c.slug, label: `${c.city}, ${countryName(c.countryCode, locale)}`, lat: c.lat, lng: c.lng })).sort((a, b) => a.label.localeCompare(b.label, locale));
  const destination = dests.some((d) => d.slug === sp.destination) ? sp.destination : undefined;
  const type = TYPES.includes(sp.type ?? "") ? sp.type : undefined;
  const posts = await getPosts({ destinationSlug: destination, type, limit: 60 });

  return (
    <>
      <header className="page-header">
        <div className="container">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1>{t("title")}</h1>
          <p className="lead">{t("lead")}</p>
        </div>
      </header>
      <section className="section section--tight">
        <div className="container dest-layout">
          <div className="stack" style={{ gap: 20 }}>
            <form className="cluster" method="get">
              <label className="visually-hidden" htmlFor="c-dest">{t("destination")}</label>
              <select id="c-dest" name="destination" className="select" defaultValue={destination ?? ""} style={{ inlineSize: "auto", minInlineSize: 220 }}>
                <option value="">{t("allDestinations")}</option>
                {dests.map((d) => <option key={d.slug} value={d.slug}>{d.label}</option>)}
              </select>
              <label className="visually-hidden" htmlFor="c-type">{t("type")}</label>
              <select id="c-type" name="type" className="select" defaultValue={type ?? ""} style={{ inlineSize: "auto", minInlineSize: 180 }}>
                <option value="">{t("allTypes")}</option>
                {TYPES.map((x) => <option key={x} value={x}>{t(`types.${x}`)}</option>)}
              </select>
              <button type="submit" className="btn"><Icon name="filter" />{t("apply")}</button>
            </form>
            <Notice>{t("opinionNotice")}</Notice>
            {posts.length ? (
              posts.map((p) => <PostCard key={p.id} post={p} signedIn={!!user} />)
            ) : (
              <div className="empty">
                <div className="icon-tile"><Icon name="users" /></div>
                <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("emptyTitle")}</h2>
                <p className="muted">{t("emptyBody")}</p>
              </div>
            )}
          </div>
          <aside className="dest-aside">
            {!user ? (
              <div className="card stack">
                <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("joinTitle")}</h2>
                <p className="small muted">{t("joinBody")}</p>
                <Link href={{ pathname: "/signup", query: { next: "/community" } }} className="btn btn--primary">{t("join")}</Link>
                <Link href={{ pathname: "/login", query: { next: "/community" } }} className="btn">{t("signIn")}</Link>
              </div>
            ) : !user.emailVerified ? (
              <Notice tone="warning">{t("verifyToPost")} <ResendVerification /></Notice>
            ) : (
              <PostForm destinations={dests} defaultDestination={destination} uploadsEnabled={features.uploads()} />
            )}
            <div className="card card--muted card--flat small stack">
              <strong>{t("guidelinesTitle")}</strong>
              <ul style={{ margin: 0 }}>
                {[1, 2, 3, 4].map((n) => <li key={n}>{t(`guideline${n}`)}</li>)}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
