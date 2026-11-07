"use client";

import { useLocale, useTranslations } from "next-intl";
import { Icon, type IconName } from "@/components/ui/Icon";
import { formatDistance, formatDuration, formatTime } from "@/lib/format";
import type { LogisticsRole } from "@/lib/itinerary/types";
import type { StopView } from "@/lib/trips";

export const ROLE_ICON: Record<LogisticsRole, IconName> = {
  day_start: "home",
  day_end: "home",
  check_in: "bed",
  check_out: "bed",
  luggage_drop: "luggage",
  luggage_pickup: "luggage",
  arrival: "plane",
  arrival_point: "train",
  departure_point: "train",
  departure: "plane",
  station_arrival: "train",
};

const TRANSFER_ICON = { train: "train", metro: "train", tram: "train", bus: "bus", boat: "ferry" } as const;
const END_ICON = { plane: "plane", train: "train", bus: "bus", car: "car", other: "pin" } as const;

/** Heading for a logistics stop, in the user's language. */
export function useLogisticsLabel() {
  const t = useTranslations("logistics");
  const locale = useLocale();
  return (s: StopView, dayStops: StopView[], timeFormat: "auto" | "12h" | "24h" = "auto"): string => {
    const l = s.logistics!;
    const place = l.booked && s.title ? s.title : t("yourStay");
    const idx = dayStops.indexOf(s);
    switch (l.role) {
      case "day_start":
        return t("leave", { place });
      case "day_end":
        return t("backAt", { place });
      case "check_in": {
        // Bags left at the accommodation earlier the same day are collected at check-in.
        const droppedHere = dayStops.slice(0, idx).some((x) => x.logistics?.role === "luggage_drop" && x.kind === "accommodation" && x.lat != null && x.lat === s.lat);
        return droppedHere ? t("collectAndCheckIn", { place }) : t("checkIn", { place });
      }
      case "check_out":
        return t("checkOut", { place });
      case "luggage_drop":
        return t("dropBags");
      case "luggage_pickup":
        return t("collectBags");
      case "arrival":
      case "station_arrival":
      case "arrival_point":
        return t("arriveAt", { place: s.title || t("yourStay") });
      case "departure_point":
        return l.fixedLeg?.label ? t("takeFrom", { service: l.fixedLeg.label, place: s.title }) : t("headTo", { place: s.title });
      case "departure":
        return l.deadline ? t("beAtBy", { place: s.title, time: formatTime(l.deadline, locale, timeFormat) }) : t("arriveAt", { place: s.title });
      default:
        return s.title;
    }
  };
}

/** The explanation and links under a logistics stop. Nothing here is a booking or a live timetable. */
export function LogisticsBody({ stop, dayStops, timeFormat, units }: { stop: StopView; dayStops: StopView[]; timeFormat: "auto" | "12h" | "24h"; units: "metric" | "imperial" }) {
  const t = useTranslations("logistics");
  const locale = useLocale();
  const l = stop.logistics!;
  const place = l.booked && stop.title ? stop.title : t("yourStay");
  const idx = dayStops.indexOf(stop);
  const time = (hhmm: string | null | undefined) => (hhmm ? formatTime(hhmm, locale, timeFormat) : "");

  if (l.role === "arrival" || l.role === "departure") {
    const mode = l.travelMode ?? "plane";
    return (
      <div className="logi">
        <p className="small" style={{ margin: 0 }}>
          <Icon name={END_ICON[mode]} className="logi__inline" />
          {l.role === "arrival"
            ? t(`arrivalAt.${mode}`, { time: time(l.at) }) + (stop.durationMin ? ` · ${t("exitTime", { duration: formatDuration(stop.durationMin, locale) })}` : "")
            : t(`departureAt.${mode}`, { time: time(l.at) })}
        </p>
        {l.role === "departure" && mode === "plane" ? <p className="small muted" style={{ margin: 0 }}>{t("airportEarly")}</p> : null}
        {l.transfers?.length ? (
          <>
            <ul className="logi__transfers">
              {l.transfers.map((o, k) => (
                <li key={k}>
                  <Icon name={TRANSFER_ICON[o.mode]} />
                  <span>
                    <bdi><strong>{o.service}</strong></bdi> · {l.role === "arrival" ? t("toPoint", { place: o.to }) : t("fromPoint", { place: o.to })} · {o.minutes[0] === o.minutes[1] ? t("typicalOne", { time: formatDuration(o.minutes[0], locale) }) : t("typicalRange", { from: o.minutes[0], to: o.minutes[1] })}
                  </span>
                  <a className="ext-link" href={o.url} target="_blank" rel="noopener noreferrer">{t("officialTimes")}<Icon name="external" className="flip-rtl" /></a>
                </li>
              ))}
            </ul>
            <p className="small muted" style={{ margin: 0 }}>{t("transferNote")}</p>
          </>
        ) : mode === "plane" ? (
          <p className="small muted" style={{ margin: 0 }}>{t("noVerifiedTransfer")}</p>
        ) : null}
        {l.directionsUrl ? (
          <div className="link-list">
            <a className="ext-link" href={l.directionsUrl} target="_blank" rel="noopener noreferrer"><Icon name="route" />{t("liveDirections")}<Icon name="external" className="flip-rtl" /></a>
          </div>
        ) : null}
      </div>
    );
  }

  if (l.role === "luggage_drop") {
    const afterCheckOut = dayStops.slice(0, idx).some((x) => x.logistics?.role === "check_out");
    const atStay = stop.kind === "accommodation" && l.booked;
    return (
      <div className="logi">
        <p className="small" style={{ margin: 0 }}>
          {atStay ? (afterCheckOut ? t("bagsAfterCheckOut", { place }) : t("bagsBeforeCheckIn", { place })) : stop.title ? t("bagsNearStation", { place: stop.title }) : afterCheckOut ? t("bagsAfterCheckOut", { place }) : t("bagsBeforeCheckIn", { place })}
        </p>
        {l.storage ? (
          <p className="small" style={{ margin: 0 }}>
            <Icon name="luggage" className="logi__inline" />
            {t("storageNear", { name: l.storage.name, distance: formatDistance(l.storage.meters, locale, units) })}
            {l.storage.url ? <> · <a href={l.storage.url} target="_blank" rel="noopener noreferrer">{t("website")}</a></> : null}
          </p>
        ) : null}
        {l.luggageUrl ? (
          <div className="link-list">
            <a className="ext-link" href={l.luggageUrl} target="_blank" rel="noopener noreferrer"><Icon name="search" />{t("findStorage")}<Icon name="external" className="flip-rtl" /></a>
          </div>
        ) : null}
        <p className="small muted" style={{ margin: 0 }}>{t("storageNote")}</p>
      </div>
    );
  }

  if (l.role === "check_in" && l.at) return <p className="small muted logi" style={{ margin: 0 }}>{t("checkInFrom", { time: time(l.at) })}</p>;
  if (l.role === "check_out" && l.at) return <p className="small muted logi" style={{ margin: 0 }}>{t("checkOutBy", { time: time(l.at) })}</p>;
  if ((l.role === "day_start" || l.role === "day_end") && !l.booked) return null;
  return null;
}
