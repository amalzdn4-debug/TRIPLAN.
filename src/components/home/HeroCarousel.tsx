"use client";

import Image from "next/image";
import { isWikimedia, sizedUrl } from "@/lib/images";
import { PhotoCredit } from "@/components/media/PhotoCredit";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { countryName } from "@/lib/format";
import type { HeroSlideData } from "@/data/hero";

const INTERVAL_MS = 7000;

/**
 * Rotating international destination hero.
 * - crossfades every 7s; pauses on hover, focus within, or when the tab is hidden
 * - honours prefers-reduced-motion (no auto-rotation, no zoom)
 * - no visible dots/arrows (owner's choice); ←/→ still work when focus is inside (e.g. on the place link)
 * - only the current and next images are requested; the next one is preloaded before it shows
 */
export function HeroCarousel({ slides, children }: { slides: HeroSlideData[]; children: React.ReactNode }) {
  const t = useTranslations("hero");
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0, slides.length > 1 ? 1 : 0]));
  const root = useRef<HTMLElement>(null);
  const count = slides.length;

  const go = useCallback(
    (i: number) => {
      const next = (i + count) % count;
      setLoaded((s) => new Set(s).add(next).add((next + 1) % count));
      setIndex(next);
    },
    [count],
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mq.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reduced) return;
    const id = window.setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [index, paused, reduced, count, go]);

  const onKey = (e: React.KeyboardEvent) => {
    const rtl = document.documentElement.dir === "rtl";
    if (e.key === "ArrowRight") go(index + (rtl ? -1 : 1));
    if (e.key === "ArrowLeft") go(index + (rtl ? 1 : -1));
  };

  const current = slides[index];
  const cityOf = (s: { city: string; cityNames?: Record<string, string> }) => s.cityNames?.[locale] ?? s.city;
  const place = `${cityOf(current)}, ${countryName(current.countryCode, locale)}`;

  return (
    <section
      ref={root}
      className="hero"
      aria-roledescription="carousel"
      aria-label={t("carouselLabel")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !root.current?.contains(e.relatedTarget as Node) && setPaused(false)}
      onKeyDown={onKey}
    >
      <div className="hero__slides">
        {slides.map((s, i) => (
          <div key={s.id} className={`hero__slide ${i === index ? "is-active" : ""}`} aria-hidden={i !== index} role="group" aria-roledescription="slide" aria-label={t("slideOf", { n: i + 1, total: count })}>
            {loaded.has(i) ? (
              <Image src={sizedUrl(s.imageUrl, "hero")} alt={i === index ? s.alt : ""} fill sizes="100vw" priority={i === 0} quality={72} unoptimized={isWikimedia(s.imageUrl)} style={{ objectFit: "cover" }} />
            ) : null}
          </div>
        ))}
      </div>

      <div className="container hero__content">
        {children}
        <div className="hero__bar">
          <div className="hero__caption" aria-live={paused || reduced ? "polite" : "off"}>
            <div>
              <div className="hero__caption-place">
                <Icon name="pin" />
                {current.destinationSlug ? (
                  <Link href={`/destinations/${current.destinationSlug}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {place}
                  </Link>
                ) : (
                  place
                )}
              </div>
              {current.creditName ? (
                <div className="hero__credit">
                  <PhotoCredit image={{ url: current.imageUrl, alt: current.alt, creditName: current.creditName, creditUrl: current.creditUrl ?? null, license: current.license, licenseUrl: current.licenseUrl, source: current.source ?? "unsplash" }} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
