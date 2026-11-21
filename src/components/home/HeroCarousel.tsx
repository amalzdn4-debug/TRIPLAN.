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

/** About 6 s per photo (owner's choice), 700 ms crossfade (CSS --dur-hero-fade). */
const INTERVAL_MS = 6_000;

/**
 * Rotating international destination hero.
 * - a new photo every ~6 s with a 700 ms crossfade; it never pauses just because the pointer is over it
 * - the next photo is preloaded while the current one shows; the switch happens only once it has
 *   loaded (no blank frames), and a photo that fails to load is skipped
 * - pauses while the tab is hidden and restarts cleanly when it's visible again
 * - smaller images on phones; honours prefers-reduced-motion (no auto-rotation, no zoom)
 * - no visible dots/arrows (owner's choice); ←/→ still work when focus is inside (e.g. on the place link)
 */
export function HeroCarousel({ slides, children }: { slides: HeroSlideData[]; children: React.ReactNode }) {
  const t = useTranslations("hero");
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set(slides.length > 1 ? [0, 1] : [0]));
  const [ready, setReady] = useState<Set<number>>(() => new Set());
  const [broken, setBroken] = useState<Set<number>>(() => new Set());
  const [waiting, setWaiting] = useState<number | null>(null);
  const root = useRef<HTMLElement>(null);
  const count = slides.length;

  /** The next slide that hasn't failed to load. */
  const nextUsable = useCallback(
    (from: number, step = 1) => {
      for (let k = 1; k <= count; k++) {
        const i = (((from + step * k) % count) + count) % count;
        if (!broken.has(i)) return i;
      }
      return from;
    },
    [count, broken],
  );

  const show = useCallback(
    (i: number) => {
      if (i === index) return;
      if (ready.has(i)) {
        setWaiting(null);
        setIndex(i);
      } else {
        // Not loaded yet: request it and switch as soon as it arrives (the current photo stays meanwhile).
        setLoaded((s) => new Set(s).add(i));
        setWaiting(i);
      }
    },
    [index, ready],
  );
  const go = useCallback((delta: number) => show(nextUsable(index, delta)), [show, nextUsable, index]);

  // Always keep the following photo loading in the background.
  useEffect(() => {
    if (count < 2) return;
    const n = nextUsable(index);
    setLoaded((s) => (s.has(n) ? s : new Set(s).add(n)));
  }, [index, count, nextUsable]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia("(max-width: 768px)");
    const update = () => {
      setReduced(mq.matches);
      setNarrow(small.matches);
    };
    update();
    mq.addEventListener("change", update);
    small.addEventListener("change", update);
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mq.removeEventListener("change", update);
      small.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (count < 2 || hidden || reduced || waiting != null) return;
    const id = window.setTimeout(() => go(1), INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [index, hidden, reduced, count, go, waiting]);

  const onLoaded = (i: number) => {
    setReady((s) => (s.has(i) ? s : new Set(s).add(i)));
    if (waiting === i) {
      setWaiting(null);
      setIndex(i);
    }
  };
  const onFailed = (i: number) => {
    setBroken((s) => new Set(s).add(i));
    if (waiting === i) setWaiting(null);
    if (i === index && count > 1) setIndex((cur) => (cur === i ? nextUsable(i) : cur));
  };

  const onKey = (e: React.KeyboardEvent) => {
    const rtl = document.documentElement.dir === "rtl";
    if (e.key === "ArrowRight") go(rtl ? -1 : 1);
    if (e.key === "ArrowLeft") go(rtl ? 1 : -1);
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
      onKeyDown={onKey}
    >
      <div className="hero__slides">
        {slides.map((s, i) => (
          <div key={s.id} className={`hero__slide ${i === index ? "is-active" : ""}`} aria-hidden={i !== index} role="group" aria-roledescription="slide" aria-label={t("slideOf", { n: i + 1, total: count })}>
            {loaded.has(i) ? (
              <Image src={sizedUrl(s.imageUrl, narrow ? "card" : "hero")} alt={i === index ? s.alt : ""} fill sizes="100vw" priority={i === 0} quality={65} unoptimized={isWikimedia(s.imageUrl)} style={{ objectFit: "cover" }} onLoad={() => onLoaded(i)} onError={() => onFailed(i)} />
            ) : null}
          </div>
        ))}
      </div>

      <div className="container hero__content">
        {children}
        <div className="hero__bar">
          <div className="hero__caption" aria-live={reduced ? "polite" : "off"}>
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
