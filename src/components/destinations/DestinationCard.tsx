import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { countryName } from "@/lib/format";
import type { DestinationCardData } from "@/lib/destinations";
import { SafeImage } from "@/components/media/SafeImage";

export function DestinationCard({ d, priority = false }: { d: DestinationCardData; priority?: boolean }) {
  const t = useTranslations("destination");
  const locale = useLocale();
  const country = countryName(d.countryCode, locale);
  return (
    <article className="dest-card">
      <div className="dest-card__media">
        <SafeImage src={d.image?.url} alt={d.image?.alt ?? ""} slot="card" title={d.city} subtitle={country} priority={priority} />
      </div>
      <div className="dest-card__body">
        <h3 className="dest-card__title">
          <Link href={`/destinations/${d.slug}`}>{d.city}</Link>
        </h3>
        <span className="dest-card__country">{country}</span>
        <p className="dest-card__summary">{d.summary}</p>
        <div className="dest-card__meta">
          {d.daysMin ? (
            <span className="badge">
              <Icon name="calendar" />
              {d.daysMin === d.daysMax ? t("daysExact", { n: d.daysMin }) : t("daysRange", { min: d.daysMin, max: d.daysMax ?? d.daysMin })}
            </span>
          ) : null}
          {d.budgetLevel ? <span className="badge badge--blue">{t(`budget.${d.budgetLevel}`)}</span> : null}
        </div>
        <span className="dest-card__cta" aria-hidden>
          {t("explore")}
          <Icon name="arrowRight" className="flip-rtl" />
        </span>
      </div>
    </article>
  );
}
