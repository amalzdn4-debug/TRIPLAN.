import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { DestinationCard } from "@/components/destinations/DestinationCard";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { getDestinationCards, getHeroSlides } from "@/lib/destinations";
import { getLatestPosts } from "@/lib/community";
import { PostCard } from "@/components/community/PostCard";
import { pageMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/auth/session";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ locale, path: "/", title: tm("title"), description: tm("description") });
}

const QUICK = [
  { key: "flights", icon: "plane" },
  { key: "hotels", icon: "bed" },
  { key: "restaurants", icon: "utensils" },
  { key: "activities", icon: "ticket" },
  { key: "luggage", icon: "luggage" },
  { key: "transport", icon: "car" },
] as const;

const FEATURES = [
  { key: "flights", icon: "plane" },
  { key: "accommodation", icon: "bed" },
  { key: "restaurants", icon: "utensils" },
  { key: "transport", icon: "bus" },
  { key: "activities", icon: "ticket" },
  { key: "luggage", icon: "luggage" },
  { key: "maps", icon: "map" },
  { key: "itineraries", icon: "calendar" },
] as const;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const [slides, cards, posts, user] = await Promise.all([getHeroSlides(), getDestinationCards(locale), getLatestPosts(locale, 3), getCurrentUser()]);
  const featured = cards.filter((c) => c.featured).slice(0, 8);
  const countries = new Set(cards.map((c) => c.countryCode)).size;
  const continents = new Set(cards.map((c) => c.continent)).size;

  return (
    <>
      <HeroCarousel slides={slides}>
        <span className="hero__tagline">{t("hero.tagline")}</span>
        <h1 className="hero__title">{t("hero.title")}</h1>
        <p className="hero__lead">{t("hero.lead")}</p>
        <div className="hero__ctas">
          <Link href="/plan" className="btn btn--gold btn--lg">
            {t("hero.start")}
            <Icon name="arrowRight" className="flip-rtl" />
          </Link>
          <Link href="/explore" className="btn btn--on-dark btn--lg">
            <Icon name="compass" />
            {t("hero.explore")}
          </Link>
        </div>
      </HeroCarousel>

      <div className="container quickbar">
        <nav className="quickbar__inner" aria-label={t("quick.label")}>
          {QUICK.map((q) => (
            <Link key={q.key} href={`/plan#${q.key}`}>
              <Icon name={q.icon} />
              {t(`quick.${q.key}`)}
            </Link>
          ))}
        </nav>
      </div>

      {/* A — How it works */}
      <section className="section" id="how-it-works">
        <div className="container">
          <Reveal className="section-head">
            <div>
              <span className="eyebrow">{t("how.eyebrow")}</span>
              <h2>{t("how.title")}</h2>
              <p>{t("how.lead")}</p>
            </div>
          </Reveal>
          <ol className="steps" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {(["tell", "organize", "explore"] as const).map((k, i) => (
              <Reveal as="li" key={k} index={i} className="step">
                <div className="icon-tile">
                  <Icon name={k === "tell" ? "edit" : k === "organize" ? "sparkles" : "map"} />
                </div>
                <h3>{t(`how.${k}.title`)}</h3>
                <p>{t(`how.${k}.body`)}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* B — Everything for your journey */}
      <section className="section section--white">
        <div className="container">
          <Reveal className="section-head">
            <div>
              <span className="eyebrow">{t("everything.eyebrow")}</span>
              <h2>{t("everything.title")}</h2>
              <p>{t("everything.lead")}</p>
            </div>
          </Reveal>
          <div className="features">
            {FEATURES.map((f, i) => (
              <Reveal key={f.key} index={i % 4} className="feature">
                <div className="icon-tile">
                  <Icon name={f.icon} />
                </div>
                <div>
                  <h3>{t(`everything.${f.key}.title`)}</h3>
                  <p>{t(`everything.${f.key}.body`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* C — Discover destinations */}
      <section className="section">
        <div className="container">
          <Reveal className="section-head">
            <div>
              <span className="eyebrow">{t("discover.eyebrow")}</span>
              <h2>{t("discover.title")}</h2>
              <p>{t("discover.lead", { count: cards.length, countries })}</p>
            </div>
            <Link href="/explore" className="btn">
              {t("discover.all")}
              <Icon name="arrowRight" className="flip-rtl" />
            </Link>
          </Reveal>
          <div className="grid grid--4">
            {featured.map((d, i) => (
              <Reveal key={d.slug} index={i % 4}>
                <DestinationCard d={d} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* D — Plan your way */}
      <section className="section section--tint" id="modes">
        <div className="container">
          <Reveal className="section-head">
            <div>
              <span className="eyebrow">{t("modes.eyebrow")}</span>
              <h2>{t("modes.title")}</h2>
              <p>{t("modes.lead")}</p>
            </div>
          </Reveal>
          <div className="grid grid--2">
            <Reveal className="mode-card">
              <div className="icon-tile icon-tile--gold">
                <Icon name="sparkles" />
              </div>
              <h3>{t("modes.fast.title")}</h3>
              <p className="muted">{t("modes.fast.body")}</p>
              <ul>
                {[1, 2, 3].map((n) => (
                  <li key={n}>
                    <Icon name="check" />
                    {t(`modes.fast.point${n}`)}
                  </li>
                ))}
              </ul>
              <Link href="/plan/fast" className="btn btn--primary">
                {t("modes.fast.cta")}
              </Link>
            </Reveal>
            <Reveal className="mode-card mode-card--dark" index={1}>
              <div className="icon-tile icon-tile--gold">
                <Icon name="settings" />
              </div>
              <h3>{t("modes.detailed.title")}</h3>
              <p>{t("modes.detailed.body")}</p>
              <ul>
                {[1, 2, 3].map((n) => (
                  <li key={n}>
                    <Icon name="check" />
                    {t(`modes.detailed.point${n}`)}
                  </li>
                ))}
              </ul>
              <Link href="/plan/detailed" className="btn btn--gold">
                {t("modes.detailed.cta")}
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* E — Why Triplan */}
      <section className="section section--white">
        <div className="container">
          <Reveal className="section-head">
            <div>
              <span className="eyebrow">{t("why.eyebrow")}</span>
              <h2>{t("why.title")}</h2>
            </div>
          </Reveal>
          <div className="grid grid--4">
            {(["time", "organized", "honest", "global"] as const).map((k, i) => (
              <Reveal key={k} index={i} className="stack">
                <div className="icon-tile">
                  <Icon name={k === "time" ? "clock" : k === "organized" ? "route" : k === "honest" ? "verified" : "globe"} />
                </div>
                <h3>{t(`why.${k}.title`)}</h3>
                <p className="muted">{t(`why.${k}.body`)}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="cluster" style={{ gap: "3rem", marginBlockStart: "3rem" }}>
            <div className="stat">
              <strong>{cards.length}</strong>
              <span className="muted small">{t("why.statDestinations")}</span>
            </div>
            <div className="stat">
              <strong>{countries}</strong>
              <span className="muted small">{t("why.statCountries")}</span>
            </div>
            <div className="stat">
              <strong>{continents}</strong>
              <span className="muted small">{t("why.statRegions")}</span>
            </div>
            <div className="stat">
              <strong>8</strong>
              <span className="muted small">{t("why.statLanguages")}</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* F — Community */}
      <section className="section">
        <div className="container">
          <Reveal className="section-head">
            <div>
              <span className="eyebrow">{t("community.eyebrow")}</span>
              <h2>{t("community.title")}</h2>
              <p>{t("community.lead")}</p>
            </div>
            <Link href="/community" className="btn">
              {t("community.all")}
              <Icon name="arrowRight" className="flip-rtl" />
            </Link>
          </Reveal>
          {posts.length ? (
            <div className="grid grid--3">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} signedIn={!!user} compact />
              ))}
            </div>
          ) : (
            <div className="empty">
              <div className="icon-tile">
                <Icon name="users" />
              </div>
              <h3>{t("community.emptyTitle")}</h3>
              <p className="muted">{t("community.emptyBody")}</p>
              <Link href="/community#share" className="btn btn--primary">
                {t("community.share")}
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* G — Final CTA */}
      <section className="section section--tight">
        <div className="container">
          <Reveal className="cta-band">
            <span className="eyebrow">{t("cta.eyebrow")}</span>
            <h2>{t("cta.title")}</h2>
            <p>{t("cta.body")}</p>
            <Link href="/plan" className="btn btn--gold btn--lg">
              {t("cta.button")}
              <Icon name="arrowRight" className="flip-rtl" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
