"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { formatTime } from "@/lib/format";
import { TravelEndFields, type TravelEndValue } from "@/components/planner/TravelEndFields";
import { TimeInput } from "@/components/planner/TimeDate";
import { DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT } from "@/lib/itinerary/logistics-defaults";
import type { TravelEnd, TripPreferences } from "@/lib/itinerary/types";

export interface LogisticsInput {
  arrival: TravelEnd | null;
  departure: TravelEnd | null;
  arrivalTime: string;
  departureTime: string;
  checkInTime: string;
  checkOutTime: string;
}

const toValue = (e: TravelEnd | null | undefined): TravelEndValue => ({ mode: e?.mode ?? "plane", name: e?.name ?? "", lat: e?.lat ?? null, lng: e?.lng ?? null });
const toEnd = (v: TravelEndValue): TravelEnd => ({ mode: v.mode, name: v.name || null, lat: v.lat, lng: v.lng });
const same = (a?: TravelEnd | null, b?: TravelEnd | null) => (a?.mode ?? null) === (b?.mode ?? null) && (a?.lat ?? null) === (b?.lat ?? null) && (a?.lng ?? null) === (b?.lng ?? null);

/** Arrival, departure and check-in/out times — editable after the trip was created; saving re-plans. */
export function TravelPanel({ prefs, destinationSlug, center, busy, timeFormat, onSave }: { prefs: TripPreferences; destinationSlug: string | null; center: { lat: number; lng: number }; busy: boolean; timeFormat: "auto" | "12h" | "24h"; onSave: (v: LogisticsInput) => void }) {
  const t = useTranslations("travelEnd");
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [arrival, setArrival] = useState<TravelEndValue>(toValue(prefs.arrival));
  const [departure, setDeparture] = useState<TravelEndValue>(toValue(prefs.departure ?? prefs.arrival));
  const [sameWay, setSameWay] = useState(!prefs.departure || same(prefs.departure, prefs.arrival));
  const [arrivalTime, setArrivalTime] = useState(prefs.departureTime ?? "");
  const [departureTime, setDepartureTime] = useState(prefs.returnTime ?? "");
  const [checkIn, setCheckIn] = useState(prefs.checkInTime ?? "");
  const [checkOut, setCheckOut] = useState(prefs.checkOutTime ?? "");
  const time = (v: string | null | undefined) => (v ? formatTime(v, locale, timeFormat) : null);
  const endText = (e: TravelEnd | null | undefined, at: string | null | undefined) =>
    e || at ? [e ? (e.name ? `${t(`modes.${e.mode}`)} · ${e.name}` : t(`modes.${e.mode}`)) : null, time(at)].filter(Boolean).join(" · ") : t("notSet");

  return (
    <section className="plan-card" aria-labelledby="travel-title">
      <h3 id="travel-title" className="plan-card__title"><Icon name="plane" />{t("title")}</h3>
      {!editing ? (
        <div className="stack" style={{ gap: 6 }}>
          <dl className="kv small">
            <dt>{t("arriving")}</dt>
            <dd><bdi>{endText(prefs.arrival, prefs.departureTime)}</bdi></dd>
            <dt>{t("leaving")}</dt>
            <dd><bdi>{endText(prefs.departure ?? prefs.arrival, prefs.returnTime)}</bdi></dd>
            <dt>{t("checkIn")}</dt>
            <dd>{time(prefs.checkInTime || DEFAULT_CHECK_IN)}{!prefs.checkInTime ? ` (${t("default")})` : ""}</dd>
            <dt>{t("checkOut")}</dt>
            <dd>{time(prefs.checkOutTime || DEFAULT_CHECK_OUT)}{!prefs.checkOutTime ? ` (${t("default")})` : ""}</dd>
          </dl>
          {!prefs.departureTime ? <p className="small muted" style={{ margin: 0 }}>{t("addForGuidance")}</p> : null}
          <button type="button" className="btn btn--sm" style={{ justifySelf: "start" }} disabled={busy} onClick={() => setEditing(true)}><Icon name="edit" />{t("edit")}</button>
        </div>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            setEditing(false);
            onSave({ arrival: toEnd(arrival), departure: sameWay ? toEnd(arrival) : toEnd(departure), arrivalTime, departureTime, checkInTime: checkIn, checkOutTime: checkOut });
          }}
        >
          <TravelEndFields idPrefix="tp-arr" legend={t("arrivalLegend")} value={arrival} onChange={setArrival} time={arrivalTime} onTimeChange={setArrivalTime} timeLabel={t("arrivalTime")} destinationSlug={destinationSlug} near={center} />
          <label className="checkbox">
            <input type="checkbox" checked={sameWay} onChange={(e) => setSameWay(e.target.checked)} />
            <span>{t("sameWay")}</span>
          </label>
          {sameWay ? (
            <div className="field">
              <label htmlFor="tp-dep-time">{t("departureTime")}</label>
              <TimeInput id="tp-dep-time" value={departureTime} onChange={setDepartureTime} />
            </div>
          ) : (
            <TravelEndFields idPrefix="tp-dep" legend={t("departureLegend")} value={departure} onChange={setDeparture} time={departureTime} onTimeChange={setDepartureTime} timeLabel={t("departureTime")} destinationSlug={destinationSlug} near={center} />
          )}
          <div className="form-row">
            <div className="field">
              <label htmlFor="tp-ci">{t("checkIn")}</label>
              <TimeInput id="tp-ci" value={checkIn} onChange={setCheckIn} placeholder={DEFAULT_CHECK_IN} />
            </div>
            <div className="field">
              <label htmlFor="tp-co">{t("checkOut")}</label>
              <TimeInput id="tp-co" value={checkOut} onChange={setCheckOut} placeholder={DEFAULT_CHECK_OUT} />
            </div>
          </div>
          <p className="small muted" style={{ margin: 0 }}>{t("replanNote")}</p>
          <div className="cluster" style={{ gap: 6 }}>
            <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>{t("save")}</button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditing(false)}>{t("cancel")}</button>
          </div>
        </form>
      )}
    </section>
  );
}
