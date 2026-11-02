import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { SafeImage } from "@/components/media/SafeImage";
import { countryName, formatDuration } from "@/lib/format";
import type { CreditedImage } from "@/lib/images";
import type { NearbyOption } from "@/lib/nearby";

const MODE_ICON = { train: "train", bus: "bus", ferry: "ferry", flight: "plane", car: "car" } as const;

/** Nearby destinations with how to get there. Journey times are typical, never live timetables. */
export async function NearbyList({ from, items }: { from: string; items: (NearbyOption & { image: CreditedImage | null })[] }) {
  const t = await getTranslations("nearby");
  const locale = await getLocale();
  return (
    <>
      <ul className="nearby-list">
        {items.map((n) => {
          const country = countryName(n.countryCode, locale);
          const time = formatDuration(n.leg.minutes, locale);
          return (
            <li key={n.slug} className="nearby-item">
              <div className="nearby-item__img">
                <SafeImage src={n.image?.url} alt={n.image?.alt ?? n.city} slot="thumb" title={n.city} subtitle={country} />
              </div>
              <div className="nearby-item__body">
                <h3>
                  <Link href={`/destinations/${n.slug}`}>{n.city}</Link>
                  <span className="small muted"> · {country}</span>
                </h3>
                <p className="nearby-item__leg">
                  <Icon name={MODE_ICON[n.leg.mode]} />
                  {n.leg.source === "estimate" ? t("legEstimate", { time }) : t("leg", { time, mode: t(`modes.${n.leg.mode}`) })}
                  {n.leg.source === "curated" ? <span className="badge badge--outline">{n.leg.direct ? t("direct") : t("withChange")}</span> : null}
                </p>
                {n.leg.note ? <p className="small muted">{n.leg.note}</p> : null}
                <div className="cluster">
                  <span className={`badge ${n.suitability === "day_trip" ? "badge--blue" : ""}`}>{t(`suitability.${n.suitability}`)}</span>
                  <span className="small muted">{t("distance", { km: n.leg.distanceKm })}</span>
                </div>
              </div>
              <Link className="btn btn--sm" href={{ pathname: "/plan/detailed", query: { destination: n.slug } }} aria-label={t("planWith", { city: n.city })}>
                {t("plan")}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="small muted" style={{ marginBlockStart: 12 }}>{t("note", { city: from })}</p>
    </>
  );
}
