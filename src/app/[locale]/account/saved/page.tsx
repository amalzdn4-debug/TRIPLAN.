import { getTranslations, setRequestLocale } from "next-intl/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guards";
import { getDb, schema } from "@/db";
import { getDestinationCards } from "@/lib/destinations";
import { getPosts } from "@/lib/community";
import { AccountNav } from "@/components/account/AccountNav";
import { DestinationCard } from "@/components/destinations/DestinationCard";
import { PostCard } from "@/components/community/PostCard";
import { Link } from "@/i18n/navigation";
import { googleMapsPlaceUrl } from "@/lib/geo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "saved" });
  return { title: t("title"), robots: { index: false } };
}

export default async function SavedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser("/account/saved");
  const t = await getTranslations("saved");
  const db = await getDb();
  const savedDest = await db.select({ id: schema.savedItems.destinationId }).from(schema.savedItems).where(and(eq(schema.savedItems.userId, user.id), isNotNull(schema.savedItems.destinationId)));
  const ids = new Set(savedDest.map((s) => s.id));
  const cards = (await getDestinationCards(locale)).filter((c) => ids.has(c.id));
  const places = await db
    .select({ id: schema.places.id, name: schema.places.name, kind: schema.places.kind, slug: schema.destinations.slug, city: schema.cities.name })
    .from(schema.savedItems)
    .innerJoin(schema.places, eq(schema.places.id, schema.savedItems.placeId))
    .innerJoin(schema.destinations, eq(schema.destinations.id, schema.places.destinationId))
    .innerJoin(schema.cities, eq(schema.cities.id, schema.destinations.cityId))
    .where(eq(schema.savedItems.userId, user.id));
  const posts = await getPosts({ savedOnly: true, limit: 50 });
  const groups = [
    { key: "restaurants", items: places.filter((p) => p.kind === "restaurant") },
    { key: "activities", items: places.filter((p) => p.kind === "activity") },
    { key: "attractions", items: places.filter((p) => p.kind !== "restaurant" && p.kind !== "activity") },
  ] as const;
  return (
    <section className="section" style={{ paddingBlockStart: "calc(var(--header-h) + 2.5rem)" }}>
      <div className="container dash-layout">
        <AccountNav current="/account/saved" isAdmin={user.role === "admin"} />
        <div className="stack" style={{ gap: 32 }}>
          <h1 style={{ fontSize: "var(--fs-2xl)" }}>{t("title")}</h1>
          <div>
            <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("destinations")}</h2>
            {cards.length ? <div className="grid grid--3">{cards.map((c) => <DestinationCard key={c.slug} d={c} />)}</div> : <p className="muted">{t("emptyDestinations")} <Link href="/explore">{t("explore")}</Link></p>}
          </div>
          {groups.map((g) => (
            <div key={g.key}>
              <h2 style={{ fontSize: "var(--fs-lg)" }}>{t(g.key)}</h2>
              {g.items.length ? (
                <ul className="place-list">
                  {g.items.map((p) => (
                    <li key={p.id} className="place-item">
                      <div style={{ flex: 1 }}>
                        <h3>{p.name}</h3>
                        <p><Link href={`/destinations/${p.slug}`}>{p.city}</Link> · <a href={googleMapsPlaceUrl(p.name, p.city)} target="_blank" rel="noopener noreferrer">{t("map")}</a></p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">{t("emptyGroup")}</p>
              )}
            </div>
          ))}
          <div>
            <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("posts")}</h2>
            {posts.length ? <div className="grid" style={{ gap: 16 }}>{posts.map((p) => <PostCard key={p.id} post={p} signedIn />)}</div> : <p className="muted">{t("emptyPosts")}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
