import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { getPost } from "@/lib/community";
import { getDestinationCards } from "@/lib/destinations";
import { countryName } from "@/lib/format";
import { features } from "@/lib/env";
import { PostForm } from "@/components/community/PostForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "community" });
  return { title: t("editTitle"), robots: { index: false, follow: false } };
}

export default async function EditPostPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(`/community/posts/${id}/edit`);
  const data = await getPost(id);
  // Only the author can edit, and only posts that haven't been hidden or removed by moderators.
  if (!data || data.post.authorId !== user.id || (data.post.status !== "published" && data.post.status !== "pending")) notFound();
  const p = data.post;
  const cards = await getDestinationCards(locale);
  const dests = cards.map((c) => ({ slug: c.slug, label: `${c.city}, ${countryName(c.countryCode, locale)}`, lat: c.lat, lng: c.lng })).sort((a, b) => a.label.localeCompare(b.label, locale));
  return (
    <section className="section" style={{ paddingBlockStart: "calc(var(--header-h) + 2rem)" }}>
      <div className="container container--narrow">
        <PostForm
          destinations={dests}
          uploadsEnabled={features.uploads()}
          initial={{ postId: p.id, destinationSlug: p.destinationSlug, type: p.type, title: p.title, body: p.body, rating: p.rating, placeName: p.placeName, lat: p.lat, lng: p.lng, photos: p.photos.map((x) => ({ id: x.id, url: x.url, alt: x.alt ?? "" })) }}
        />
      </div>
    </section>
  );
}
