import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { and, eq } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { getDb, schema } from "@/db";
import { getDestinationCards, getDestinationDetail, getNearby } from "@/lib/destinations";
import { getPosts } from "@/lib/community";
import { getCurrentUser } from "@/lib/auth/session";
import { countryName, monthName } from "@/lib/format";
import { accommodationLinks, activityLinks, flightLinks, luggageLinks, restaurantSearchUrl, transportLinks } from "@/lib/links";
import { withPartners } from "@/lib/affiliates";
import { OutboundLinks as Links, PartnerDisclosure } from "@/components/ui/OutboundLinks";
import { googleMapsPlaceUrl } from "@/lib/geo";
import { pageMetadata } from "@/lib/seo";
import { siteUrl } from "@/config/site";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Form";
import { Reveal } from "@/components/ui/Reveal";
import { DestinationCard } from "@/components/destinations/DestinationCard";
import { SaveButton } from "@/components/destinations/SaveButton";
import { PostCard } from "@/components/community/PostCard";
import { SafeImage } from "@/components/media/SafeImage";
import { PhotoCredit } from "@/components/media/PhotoCredit";
import { NearbyList } from "@/components/destinations/NearbyList";
import { formatDuration } from "@/lib/format";
import type { CreditedImage } from "@/lib/images";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const d = await getDestinationDetail(slug, locale).catch(() => null);
  if (!d) return {};
  const t = await getTranslations({ locale, namespace: "destination" });
  return pageMetadata({
    locale,
    path: `/destinations/${slug}`,
    title: t("metaTitle", { city: d.displayName, country: countryName(d.city.countryCode, locale) }),
    description: d.summary,
    image: d.images[0]?.url,
  });
}

export default async function DestinationPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const d = await getDestinationDetail(slug, locale);
  if (!d) notFound();
  const t = await getTranslations("destination");
  const te = await getTranslations("explore");
  const tc = await getTranslations("common");
  const user = await getCurrentUser();
  const [posts, cards, nearby] = await Promise.all([getPosts({ destinationSlug: slug, limit: 6 }), getDestinationCards(locale), getNearby(slug, locale, 8)]);
  let saved = false;
  if (user) {
    const db = await getDb();
    saved = (await db.select({ id: schema.savedItems.id }).from(schema.savedItems).where(and(eq(schema.savedItems.userId, user.id), eq(schema.savedItems.destinationId, d.id)))).length > 0;
  }
  // Shown in the visitor's language; external searches use the English name, which every site understands.
  const city = d.displayName;
  const cityEn = d.city.name;
  const country = countryName(d.city.countryCode, locale);
  const go = { source: "destination", destination: slug, city: cityEn, country: d.city.countryCode, locale, lat: d.city.lat, lng: d.city.lng };
  const [stayLinks, flyLinks, moveLinks, bagLinks, doLinks] = await Promise.all([
    withPartners(accommodationLinks(cityEn), go),
    withPartners(flightLinks(cityEn), go),
    withPartners(transportLinks(cityEn), go),
    withPartners(luggageLinks(cityEn), go),
    withPartners(activityLinks(cityEn), go),
  ]);
  const images: CreditedImage[] = d.images.map((i) => ({ url: i.url, alt: i.alt, creditName: i.creditName, creditUrl: i.creditUrl, license: i.license, licenseUrl: i.licenseUrl, source: i.source }));
  const image = images[0];
  const gallery = images.slice(1, 6);
  const localName = (p: { name: string; details: unknown }) => ((p.details as { names?: Record<string, string> })?.names?.[locale] ?? p.name);
  const attractions = d.places.filter((p) => p.kind === "attraction" || p.kind === "activity");
  const hubs = d.places.filter((p) => p.kind === "transport_hub");
  const restaurants = d.places.filter((p) => p.kind === "restaurant");
  const luggage = d.places.filter((p) => p.kind === "luggage_storage");
  const related = cards.filter((c) => c.continent === d.continent && c.slug !== d.slug).slice(0, 4);
  const months = (d.bestMonths ?? []).slice().sort((a, b) => a - b);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: city,
    description: d.summary,
    url: `${siteUrl()}/${locale}/destinations/${slug}`,
    geo: { "@type": "GeoCoordinates", latitude: d.city.lat, longitude: d.city.lng },
    containedInPlace: { "@type": "Country", name: country },
    ...(image ? { image: image.url } : {}),
    includesAttraction: attractions.slice(0, 10).map((a) => ({ "@type": "TouristAttraction", name: a.name, geo: { "@type": "GeoCoordinates", latitude: a.lat, longitude: a.lng } })),
  };

  const SECTIONS = ["overview", "attractions", "nearby", "neighborhoods", "food", "stay", "transport", "luggage", "activities", "community"] as const;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="dest-hero">
        <SafeImage src={image?.url} alt={image?.alt ?? city} slot="hero" title="" priority />
        <div className="container dest-hero__content">
          <ol className="breadcrumbs">
            <li><Link href="/">{t("home")}</Link></li>
            <li><Link href="/explore">{te("title")}</Link></li>
            <li aria-current="page">{city}</li>
          </ol>
          <span className="eyebrow" style={{ color: "var(--tp-gold)" }}>{te(`continents.${d.continent}`)} · {country}</span>
          <h1>{city}</h1>
          <p>{d.summary}</p>
          <div className="cluster" style={{ marginBlockStart: 24 }}>
            <Link href={{ pathname: "/plan/fast", query: { destination: slug } }} className="btn btn--gold btn--lg">
              {t("planCta", { city })}
              <Icon name="arrowRight" className="flip-rtl" />
            </Link>
            <SaveButton id={d.id} kind="destination" initial={saved} signedIn={!!user} onDark />
          </div>
          {image ? (
            <p className="hero__credit" style={{ marginBlockStart: 16 }}>
              <PhotoCredit image={image} />
            </p>
          ) : null}
        </div>
      </section>

      <nav className="sub-nav" aria-label={t("sections")}>
        <div className="container">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s}><a href={`#${s}`}>{t(`nav.${s}`)}</a></li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="container dest-layout">
        <div>
          <section className="dest-section" id="overview">
            <h2><Icon name="compass" />{t("nav.overview")}</h2>
            {d.contentStatus === "sample" ? <Notice tone="warning">{t("sampleNotice")}</Notice> : <span className="badge badge--blue"><Icon name="verified" />{t("verified")}</span>}
            {!d.translatedContent ? <p className="small muted" style={{ marginBlockStart: 12 }}>{t("englishOnly")}</p> : null}
            {d.description ? (
              <div className="prose" style={{ marginBlockStart: 16 }}>
                {d.description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
              </div>
            ) : null}
            {d.wikiUrl ? (
              <p className="small muted">
                {t("wikiSource")} <a href={d.wikiUrl} target="_blank" rel="noopener noreferrer">Wikipedia</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer license">CC BY-SA 4.0</a>)
              </p>
            ) : null}
            {gallery.length ? (
              <ul className="gallery" aria-label={t("gallery")}>
                {gallery.map((g) => (
                  <li key={g.url}>
                    <figure>
                      <div className="gallery__img"><SafeImage src={g.url} alt={g.alt} slot="thumb" title={city} /></div>
                      <figcaption>{g.alt}<br /><PhotoCredit image={g} /></figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="facts" style={{ marginBlockStart: 20 }}>
              <div className="fact"><span>{t("bestTime")}</span><strong>{months.length ? months.map((m) => monthName(m, locale)).join(", ") : d.bestTime}</strong></div>
              <div className="fact"><span>{t("duration")}</span><strong>{d.suggestedDaysMin ? t("daysRange", { min: d.suggestedDaysMin, max: d.suggestedDaysMax ?? d.suggestedDaysMin }) : "—"}</strong></div>
              <div className="fact"><span>{t("budgetLevel")}</span><strong>{d.budgetLevel ? t(`budget.${d.budgetLevel}`) : "—"}</strong></div>
              <div className="fact"><span>{t("climate")}</span><strong>{d.climate ? te(`climates.${d.climate}`) : "—"}</strong></div>
            </div>
            <p className="small muted" style={{ marginBlockStart: 12 }}>{t("budgetNote")}</p>
          </section>

          <section className="dest-section" id="attractions">
            <h2><Icon name="ticket" />{t("nav.attractions")}</h2>
            {attractions.length ? (
              <ul className="place-list">
                {attractions.slice(0, 16).map((p, i) => (
                  <Reveal as="li" key={p.id} index={i % 4} className="place-item">
                    {p.imageUrl ? (
                      <div className="place-item__thumb"><SafeImage src={p.imageUrl} alt={localName(p)} slot="thumb" title="" /></div>
                    ) : (
                      <div className="icon-tile" style={{ inlineSize: 44, blockSize: 44 }}><Icon name={p.kind === "activity" ? "sparkles" : "pin"} /></div>
                    )}
                    <div style={{ flex: 1 }}>
                      <h3>{localName(p)}</h3>
                      {p.neighborhood || p.durationMin ? (
                        <p>{[p.neighborhood, p.durationMin ? t("visitLength", { time: formatDuration(p.durationMin, locale) }) : null].filter(Boolean).join(" · ")}</p>
                      ) : null}
                      <div className="cluster">
                        {p.tags.filter((tag) => tag !== "landmark").slice(0, 3).map((tag) => (
                          <span key={tag} className="badge">{te.has(`experiences.${tag}`) ? te(`experiences.${tag}`) : tag.replace(/_/g, " ")}</span>
                        ))}
                        <span className={`badge ${p.verification === "verified" ? "badge--blue" : "badge--outline"}`}>{p.verification === "verified" ? t("verified") : t("sample")}</span>
                        <a className="small" href={googleMapsPlaceUrl(p.name, city)} target="_blank" rel="noopener noreferrer">{t("openMap")}</a>
                        {p.websiteUrl && /^https:\/\//.test(p.websiteUrl) ? (
                          <a className="small" href={p.websiteUrl} target="_blank" rel="noopener noreferrer">
                            {(p.details as { ticketed?: boolean } | null)?.ticketed || p.tags.includes("museums") ? t("ticketsOfficial") : t("officialSite")}
                          </a>
                        ) : null}
                        {p.imageUrl && p.imageCredit ? <span className="small muted">{t("photoBy")} {p.imageCredit}, {p.imageLicense}</span> : null}
                      </div>
                    </div>
                    <SaveButton id={p.id} kind="place" initial={false} signedIn={!!user} />
                  </Reveal>
                ))}
              </ul>
            ) : (
              <p className="muted">{t("noAttractions")}</p>
            )}
          </section>

          <section className="dest-section" id="nearby">
            <h2><Icon name="compass" />{t("nav.nearby")}</h2>
            <p className="muted">{t("nearbyLead", { city })}</p>
            {nearby.length ? <NearbyList from={city} items={nearby} /> : <p className="muted">{t("noNearby")}</p>}
          </section>

          <section className="dest-section" id="neighborhoods">
            <h2><Icon name="map" />{t("nav.neighborhoods")}</h2>
            {d.neighborhoods.length ? (
              <div className="cluster">{d.neighborhoods.map((n) => <span key={n.name} className="badge badge--outline" style={{ fontSize: 14, padding: "6px 14px" }}>{n.name}</span>)}</div>
            ) : (
              <p className="muted">{t("noNeighborhoods")}</p>
            )}
          </section>

          <section className="dest-section" id="food">
            <h2><Icon name="utensils" />{t("nav.food")}</h2>
            {restaurants.length ? (
              <ul className="place-list" style={{ marginBlockEnd: 20 }}>
                {restaurants.map((r) => (
                  <li key={r.id} className="place-item">
                    <div style={{ flex: 1 }}>
                      <h3>{r.name}</h3>
                      <p>{[r.cuisine, r.neighborhood].filter(Boolean).join(" · ")}</p>
                      <div className="cluster">
                        {r.verification === "verified" ? r.dietaryTags.map((tag) => <span key={tag} className="badge badge--blue">{t.has(`diet.${tag}`) ? t(`diet.${tag}`) : tag}</span>) : null}
                        {r.priceLevel ? <span className="badge">{"€".repeat(r.priceLevel)}</span> : null}
                        {r.websiteUrl ? <a className="small" href={r.websiteUrl} target="_blank" rel="noopener noreferrer">{t("website")}</a> : null}
                      </div>
                    </div>
                    <SaveButton id={r.id} kind="place" initial={false} signedIn={!!user} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t("noRestaurants")}</p>
            )}
            <p className="small" style={{ fontWeight: 600 }}>{t("searchFood")}</p>
            <div className="link-list">
              {(["local", "halal", "vegetarian", "vegan", "seafood", "fine_dining", "budget"] as const).map((f) => (
                <a key={f} className="ext-link" href={restaurantSearchUrl({ foodPrefs: [f], city: cityEn })} target="_blank" rel="noopener noreferrer">
                  {t(`foodSearch.${f}`)}
                  <Icon name="external" className="flip-rtl" />
                </a>
              ))}
            </div>
            <p className="small muted" style={{ marginBlockStart: 12 }}>{t("dietNote")}</p>
          </section>

          <section className="dest-section" id="stay">
            <h2><Icon name="bed" />{t("nav.stay")}</h2>
            <p className="muted">{t("stayIntro")}</p>
            <Links links={stayLinks} />
            <h3 style={{ marginBlockStart: 24 }}>{t("flights")}</h3>
            <Links links={flyLinks} />
            <p className="small muted" style={{ marginBlockStart: 12 }}>{t("externalNote")} <PartnerDisclosure links={[...stayLinks, ...flyLinks]} /></p>
          </section>

          <section className="dest-section" id="transport">
            <h2><Icon name="bus" />{t("nav.transport")}</h2>
            {d.transport.length ? (
              <ul className="place-list" style={{ marginBlockEnd: 16 }}>
                {d.transport.map((o) => (
                  <li key={o.id} className="place-item">
                    <div>
                      <h3>{o.title}</h3>
                      {o.description ? <p>{o.description}</p> : null}
                      {o.url ? <a className="small" href={o.url} target="_blank" rel="noopener noreferrer">{t("moreInfo")}</a> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t("transportIntro")}</p>
            )}
            {hubs.length ? (
              <ul className="place-list" style={{ marginBlockEnd: 16 }}>
                {hubs.map((h) => {
                  const hub = (h.details as { hub?: "airport" | "rail" | "bus" })?.hub ?? "rail";
                  return (
                    <li key={h.id} className="place-item">
                      <div className="icon-tile" style={{ inlineSize: 44, blockSize: 44 }}><Icon name={hub === "airport" ? "plane" : hub === "bus" ? "bus" : "train"} /></div>
                      <div style={{ flex: 1 }}>
                        <h3>{localName(h)}</h3>
                        <p>{t(`hubs.${hub}`)}</p>
                        <a className="small" href={googleMapsPlaceUrl(h.name, city)} target="_blank" rel="noopener noreferrer">{t("openMap")}</a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <Links links={moveLinks} />
          </section>

          <section className="dest-section" id="luggage">
            <h2><Icon name="luggage" />{t("nav.luggage")}</h2>
            <p className="muted">{t("luggageIntro")}</p>
            {luggage.length ? (
              <ul className="place-list" style={{ marginBlockEnd: 16 }}>
                {luggage.map((l) => (
                  <li key={l.id} className="place-item">
                    <div>
                      <h3>{l.name}</h3>
                      <p>{l.address ?? l.neighborhood}</p>
                      {l.bookingUrl ? <a className="small" href={l.bookingUrl} target="_blank" rel="noopener noreferrer">{t("book")}</a> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            <Links links={bagLinks} />
            <p className="small muted" style={{ marginBlockStart: 12 }}>{t("availabilityNote")} <PartnerDisclosure links={[...moveLinks, ...bagLinks, ...doLinks]} /></p>
          </section>

          <section className="dest-section" id="activities">
            <h2><Icon name="sparkles" />{t("nav.activities")}</h2>
            <p className="muted">{t("activitiesIntro")}</p>
            <Links links={doLinks} />
          </section>

          <section className="dest-section" id="community">
            <h2><Icon name="users" />{t("nav.community")}</h2>
            <p className="small muted">{t("communityNote")}</p>
            {posts.length ? (
              <div className="grid" style={{ gap: 16 }}>
                {posts.map((p) => <PostCard key={p.id} post={p} signedIn={!!user} />)}
              </div>
            ) : (
              <div className="empty">
                <p className="muted">{t("noPosts", { city })}</p>
                <Link href={{ pathname: "/community", query: { destination: slug } }} className="btn btn--primary">{t("sharePost")}</Link>
              </div>
            )}
          </section>
        </div>

        <aside className="dest-aside" style={{ paddingBlock: 40 }}>
          <div className="card stack">
            <h3>{t("asideTitle", { city })}</h3>
            <p className="small muted">{t("asideBody")}</p>
            <Link href={{ pathname: "/plan/fast", query: { destination: slug } }} className="btn btn--primary btn--block">{t("fastCta")}</Link>
            <Link href={{ pathname: "/plan/detailed", query: { destination: slug } }} className="btn btn--block">{t("detailedCta")}</Link>
          </div>
        </aside>
      </div>

      {related.length ? (
        <section className="section section--white">
          <div className="container">
            <div className="section-head"><div><h2>{t("related")}</h2></div></div>
            <div className="grid grid--4">{related.map((r) => <DestinationCard key={r.slug} d={r} />)}</div>
          </div>
        </section>
      ) : null}
    </>
  );
}
