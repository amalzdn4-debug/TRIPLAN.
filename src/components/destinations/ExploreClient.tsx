"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DestinationCard } from "./DestinationCard";
import { Icon } from "@/components/ui/Icon";
import { countryName, monthName } from "@/lib/format";
import type { DestinationCardData } from "@/lib/destinations";

const CONTINENTS = ["europe", "mena", "asia", "north_america", "south_america", "africa", "oceania"];
const STYLES = ["city_break", "culture", "beach", "nature", "food", "romantic", "family", "adventure", "luxury", "budget"];
const EXPERIENCES = ["museums", "architecture", "history", "nightlife", "shopping", "beaches", "hiking", "food", "markets", "photography", "relaxation", "local"];
const CLIMATES = ["temperate", "mediterranean", "tropical", "desert", "continental", "subtropical", "oceanic"];
const BUDGETS = ["budget", "mid", "premium"];

type Filters = { q: string; continent: string; country: string; style: string; budget: string; climate: string; month: string; experience: string; sort: string };
const EMPTY: Filters = { q: "", continent: "", country: "", style: "", budget: "", climate: "", month: "", experience: "", sort: "popular" };

export function ExploreClient({ destinations, initial }: { destinations: DestinationCardData[]; initial?: Partial<Filters> }) {
  const t = useTranslations("explore");
  const td = useTranslations("destination");
  const locale = useLocale();
  const [f, setF] = useState<Filters>({ ...EMPTY, ...initial });
  const [open, setOpen] = useState(false);
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const countries = useMemo(
    () =>
      Array.from(new Set(destinations.map((d) => d.countryCode)))
        .map((c) => ({ code: c, name: countryName(c, locale) }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [destinations, locale],
  );

  const results = useMemo(() => {
    const q = f.q.trim().toLocaleLowerCase(locale);
    const list = destinations.filter((d) => {
      if (q && !`${d.city} ${d.cityEn ?? ""} ${countryName(d.countryCode, locale)} ${d.countryCode}`.toLocaleLowerCase(locale).includes(q)) return false;
      if (f.continent && d.continent !== f.continent) return false;
      if (f.country && d.countryCode !== f.country) return false;
      if (f.style && !d.travelStyles.includes(f.style)) return false;
      if (f.experience && !d.experiences.includes(f.experience)) return false;
      if (f.budget && d.budgetLevel !== f.budget) return false;
      if (f.climate && d.climate !== f.climate) return false;
      if (f.month && !d.bestMonths.includes(Number(f.month))) return false;
      return true;
    });
    if (f.sort === "name") list.sort((a, b) => a.city.localeCompare(b.city, locale));
    else if (f.sort === "short") list.sort((a, b) => (a.daysMin ?? 99) - (b.daysMin ?? 99));
    else list.sort((a, b) => b.popularity - a.popularity);
    return list;
  }, [destinations, f, locale]);

  const activeCount = Object.entries(f).filter(([k, v]) => k !== "sort" && k !== "q" && v).length;

  const select = (k: keyof Filters, label: string, options: { value: string; label: string }[]) => (
    <div className="field">
      <label htmlFor={`f-${k}`}>{label}</label>
      <select id={`f-${k}`} className="select" value={f[k]} onChange={set(k)}>
        <option value="">{t("any")}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="explore-layout">
      <aside className={`filters ${open ? "is-open" : ""}`} aria-label={t("filters")} id="explore-filters">
        {select("continent", t("continent"), CONTINENTS.map((c) => ({ value: c, label: t(`continents.${c}`) })))}
        {select("country", t("country"), countries.map((c) => ({ value: c.code, label: c.name })))}
        {select("style", t("style"), STYLES.map((s) => ({ value: s, label: t(`styles.${s}`) })))}
        {select("experience", t("experience"), EXPERIENCES.map((s) => ({ value: s, label: t(`experiences.${s}`) })))}
        {select("budget", t("budget"), BUDGETS.map((b) => ({ value: b, label: td(`budget.${b}`) })))}
        {select("climate", t("climate"), CLIMATES.map((c) => ({ value: c, label: t(`climates.${c}`) })))}
        {select("month", t("month"), Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1, locale) })))}
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setF((s) => ({ ...EMPTY, sort: s.sort }))} disabled={!activeCount && !f.q}>
          {t("reset")}
        </button>
      </aside>
      <div>
        <div className="toolbar">
          <div className="search-input">
            <Icon name="search" />
            <label className="visually-hidden" htmlFor="explore-q">
              {t("search")}
            </label>
            <input id="explore-q" className="input" type="search" placeholder={t("searchPlaceholder")} value={f.q} onChange={set("q")} />
          </div>
          <button type="button" className="btn filters__toggle" aria-expanded={open} aria-controls="explore-filters" onClick={() => setOpen((o) => !o)}>
            <Icon name="filter" />
            {t("filters")}
            {activeCount ? <span className="badge badge--navy">{activeCount}</span> : null}
          </button>
          <div className="field" style={{ flexDirection: "row" }}>
            <label htmlFor="explore-sort" className="visually-hidden">
              {t("sort")}
            </label>
            <select id="explore-sort" className="select" value={f.sort} onChange={set("sort")} style={{ minInlineSize: 180 }}>
              <option value="popular">{t("sortPopular")}</option>
              <option value="name">{t("sortName")}</option>
              <option value="short">{t("sortShort")}</option>
            </select>
          </div>
        </div>
        <p className="small muted" role="status" aria-live="polite">
          {t("results", { count: results.length })}
        </p>
        {results.length ? (
          <div className="grid grid--3">
            {results.map((d, i) => (
              <DestinationCard key={d.slug} d={d} priority={i < 3} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="icon-tile">
              <Icon name="search" />
            </div>
            <h3>{t("noResults")}</h3>
            <p className="muted">{t("noResultsHint")}</p>
            <button type="button" className="btn" onClick={() => setF(EMPTY)}>
              {t("reset")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
