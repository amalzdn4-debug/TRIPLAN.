import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPost } from "@/lib/community";
import { getCurrentUser } from "@/lib/auth/session";
import { PostCard } from "@/components/community/PostCard";
import { Comments } from "@/components/community/Comments";
import { Notice } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { features } from "@/lib/env";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: "community" });
  const data = await getPost(id);
  if (!data) return { title: t("title") };
  const p = data.post;
  // Posts are user content: indexable only while published.
  return {
    title: `${p.title} · ${p.destinationCity}`,
    description: p.body.slice(0, 160),
    robots: p.status === "published" ? undefined : { index: false, follow: false },
    openGraph: p.photos[0] ? { images: [{ url: p.photos[0].url }] } : undefined,
  };
}

export default async function PostPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("community");
  const data = await getPost(id);
  if (!data) notFound();
  const user = await getCurrentUser();
  const { post, comments } = data;
  return (
    <section className="section" style={{ paddingBlockStart: "calc(var(--header-h) + 2rem)" }}>
      <div className="container container--narrow stack" style={{ gap: 24 }}>
        <Link href="/community" className="back-link">
          <Icon name="arrowLeft" className="flip-rtl" style={{ inlineSize: 14, blockSize: 14 }} /> {t("backToCommunity")}
        </Link>
        <Notice>{t("opinionNotice")}</Notice>
        <PostCard post={post} signedIn={!!user} full />
        <Comments postId={post.id} comments={comments} signedIn={!!user} verified={!!user?.emailVerified} emailAvailable={features.emailDelivery()} canComment={post.status === "published"} />
      </div>
    </section>
  );
}
