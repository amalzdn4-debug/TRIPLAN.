"use client";

import { useTranslations } from "next-intl";
import { AddressSearch } from "@/components/map/AddressSearch";
import { airportsServing } from "@/data/airport-transfers";
import { TimeInput } from "./TimeDate";
import type { TravelEnd } from "@/lib/itinerary/types";

export type TravelEndValue = { mode: TravelEnd["mode"]; name: string; lat: number | null; lng: number | null };

const MODES: TravelEnd["mode"][] = ["plane", "train", "bus", "car", "other"];

/**
 * How the traveller arrives (or leaves): plane/train/bus with the actual airport or station from the
 * address search, plus the time. Airports with verified transfer details are offered as quick picks.
 */
export function TravelEndFields({
  idPrefix,
  legend,
  value,
  onChange,
  time,
  onTimeChange,
  timeLabel,
  destinationSlug,
  near,
  timeError,
}: {
  idPrefix: string;
  legend: string;
  value: TravelEndValue;
  onChange: (v: TravelEndValue) => void;
  time: string;
  onTimeChange: (v: string) => void;
  timeLabel: string;
  destinationSlug?: string | null;
  near?: { lat: number; lng: number } | null;
  timeError?: string | null;
}) {
  const t = useTranslations("travelEnd");
  const located = value.mode === "plane" || value.mode === "train" || value.mode === "bus";
  const quick = value.mode === "plane" ? airportsServing(destinationSlug) : [];
  return (
    <fieldset className="travel-end">
      <legend>{legend}</legend>
      <div className="form-row">
        <div className="field">
          <label htmlFor={`${idPrefix}-mode`}>{t("how")}</label>
          <select id={`${idPrefix}-mode`} className="select" value={value.mode} onChange={(e) => onChange({ mode: e.target.value as TravelEnd["mode"], name: "", lat: null, lng: null })}>
            {MODES.map((m) => <option key={m} value={m}>{t(`modes.${m}`)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-time`}>{timeLabel}</label>
          <TimeInput id={`${idPrefix}-time`} value={time} onChange={onTimeChange} aria-describedby={`${idPrefix}-time-hint`} aria-invalid={timeError ? true : undefined} />
          <p id={`${idPrefix}-time-hint`} className="field-hint">{t("timeHint")}</p>
          {timeError ? <p className="field-error" role="alert">{timeError}</p> : null}
        </div>
      </div>
      {located ? (
        <>
          {quick.length ? (
            <div className="cluster" style={{ gap: 6 }} role="group" aria-label={t("quickAirports")}>
              {quick.map((a) => (
                <button
                  key={a.iata}
                  type="button"
                  className="pick-chip"
                  aria-pressed={value.lat === a.lat && value.lng === a.lng}
                  onClick={() => onChange({ mode: "plane", name: a.name, lat: a.lat, lng: a.lng })}
                >
                  {a.name} <span className="muted ltr">({a.iata})</span>
                </button>
              ))}
            </div>
          ) : null}
          <AddressSearch
            id={`${idPrefix}-place`}
            label={t(`place.${value.mode}`)}
            kind={value.mode === "plane" ? "airport" : value.mode === "train" ? "station" : "address"}
            near={near}
            value={value.name}
            onChange={(name) => onChange({ ...value, name, lat: null, lng: null })}
            onPick={(p) => onChange({ ...value, name: p.name, lat: p.lat, lng: p.lng })}
            hint={value.lat != null ? t("found") : t("placeHint")}
          />
        </>
      ) : null}
    </fieldset>
  );
}
