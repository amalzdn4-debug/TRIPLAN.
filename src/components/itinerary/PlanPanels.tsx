"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon, type IconName } from "@/components/ui/Icon";
import { formatDate, formatDuration } from "@/lib/format";
import type { IntercityDetails, TripPreferences } from "@/lib/itinerary/types";
import type { SplitOption, TripSegment } from "@/lib/itinerary/split";
import type { NearbyChoice, SplitChoice, StayArea, TripPlanning } from "@/lib/trips";
import { OutboundLinks, PartnerDisclosure } from "@/components/ui/OutboundLinks";

const LocationPicker = dynamic(() => import("@/components/map/LocationPicker").then((m) => m.LocationPicker), { ssr: false });

export const MODE_ICON: Record<IntercityDetails["mode"], IconName> = { train: "train", bus: "bus", ferry: "ferry", flight: "plane", car: "car" };

function LegLine({ mode, minutes, direct, source }: { mode: IntercityDetails["mode"]; minutes: number; direct: boolean; source: "curated" | "estimate" }) {
  const tn = useTranslations("nearby");
  const locale = useLocale();
  return (
    <span className="leg-line">
      <Icon name={MODE_ICON[mode]} />
      {tn(source === "curated" ? "leg" : "legEstimate", { mode: tn(`modes.${mode}`), time: formatDuration(minutes, locale) })}
      {mode !== "car" ? <span className="badge badge--outline">{direct ? tn("direct") : tn("withChange")}</span> : null}
    </span>
  );
}

/* ───────────── Stay-length suggestion ───────────── */

export function SplitSuggestionCard({
  planning,
  busy,
  onAccept,
  onDecline,
}: {
  planning: TripPlanning;
  busy: boolean;
  onAccept: (c: SplitChoice) => void;
  onDecline: () => void;
}) {
  const ts = useTranslations("split");
  const s = planning.suggestion!;
  const [choice, setChoice] = useState(s.options[0]?.id ?? "");
  const [browsing, setBrowsing] = useState(false);
  const optionText = (o: SplitOption) => {
    const parts = [ts("daysIn", { n: o.baseDays, city: s.baseName })];
    for (const e of o.extras) parts.push(e.type === "day_trip" ? ts("dayTripTo", { city: e.name }) : ts("daysIn", { n: e.days, city: e.name }));
    return parts.join(" + ");
  };
  return (
    <section className="plan-card plan-card--suggest" aria-labelledby="split-title">
      <div className="plan-card__head">
        <Icon name="sparkles" />
        <div>
          <h3 id="split-title">{ts("title")}</h3>
          <p className="small">{ts("lead", { city: s.baseName, capacity: s.capacity, total: s.totalDays })}</p>
        </div>
      </div>
      {!browsing ? (
        <>
          <fieldset className="split-options">
            <legend className="visually-hidden">{ts("optionsLegend")}</legend>
            {s.options.map((o) => (
              <label key={o.id} className={`split-option ${choice === o.id ? "is-selected" : ""}`}>
                <input type="radio" name="split" value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} />
                <span style={{ display: "grid", gap: 4 }}>
                  <strong>{optionText(o)}</strong>
                  {o.extras.map((e) => (e.leg ? (
                    <span key={e.slug} className="small muted">
                      {s.baseName} → {e.name}: <LegLine mode={e.leg.mode} minutes={e.leg.minutes} direct={e.leg.direct} source={e.leg.source} />
                    </span>
                  ) : null))}
                </span>
              </label>
            ))}
          </fieldset>
          <p className="small muted">{ts("typicalNote")}</p>
          <div className="cluster" style={{ gap: 8 }}>
            <button type="button" className="btn btn--primary btn--sm" disabled={busy || !choice} onClick={() => onAccept({ optionId: choice })}>
              <Icon name="check" />{ts("accept")}
            </button>
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => setBrowsing(true)}>
              <Icon name="shuffle" />{ts("other")}
            </button>
            <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={onDecline}>
              {ts("keep", { city: s.baseName })}
            </button>
          </div>
        </>
      ) : (
        <NearbyPicker nearby={planning.nearby} busy={busy} onPick={onAccept} onBack={() => setBrowsing(false)} />
      )}
    </section>
  );
}

function NearbyPicker({ nearby, busy, onPick, onBack }: { nearby: NearbyChoice[]; busy: boolean; onPick: (c: SplitChoice) => void; onBack: () => void }) {
  const ts = useTranslations("split");
  const tn = useTranslations("nearby");
  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="small">{ts("pickLead")}</p>
      {nearby.length ? (
        <ul className="nearby-pick">
          {nearby.map((n) => (
            <li key={n.slug}>
              <div>
                <strong>{n.city}</strong>
                <span className="small muted"> · {tn(`suitability.${n.suitability}`)} · {tn("distance", { km: n.distanceKm })}</span>
                <br />
                <LegLine mode={n.mode} minutes={n.minutes} direct={n.direct} source={n.source} />
              </div>
              <div className="cluster" style={{ gap: 6 }}>
                {n.suitability === "day_trip" && n.mode !== "flight" ? (
                  <button type="button" className="btn btn--sm" disabled={busy} onClick={() => onPick({ slug: n.slug, type: "day_trip" })}>{ts("asDayTrip")}</button>
                ) : null}
                <button type="button" className="btn btn--sm" disabled={busy} onClick={() => onPick({ slug: n.slug, type: "stay" })}>{ts("asStay")}</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">{ts("noneNearby")}</p>
      )}
      <button type="button" className="btn btn--sm btn--ghost" onClick={onBack}>
        <span className="flip-rtl" aria-hidden>←</span> {ts("back")}
      </button>
    </div>
  );
}

/* ───────────── Route summary (multi-city) ───────────── */

export function RouteSummary({ segments, busy, onReset }: { segments: TripSegment[]; busy: boolean; onReset: () => void }) {
  const ts = useTranslations("split");
  const base = segments[0];
  const stays = segments.filter((s) => s.type !== "day_trip");
  const trips = segments.filter((s) => s.type === "day_trip");
  return (
    <section className="plan-card" aria-labelledby="route-title">
      <h3 id="route-title" className="plan-card__title"><Icon name="route" />{ts("routeTitle")}</h3>
      <ol className="route-chain">
        {stays.map((s, i) => (
          <li key={s.slug}>
            {i > 0 && s.leg ? <span className="route-chain__leg"><Icon name={MODE_ICON[s.leg.mode]} /><span className="visually-hidden">{ts("then")}</span></span> : null}
            <span className="route-chain__stop"><strong>{s.name}</strong> <span className="small muted">{ts("nDays", { n: s.days })}</span></span>
          </li>
        ))}
      </ol>
      {trips.length ? <p className="small">{ts("dayTripsFrom", { city: base.name, places: trips.map((x) => x.name).join(", ") })}</p> : null}
      <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => confirm(ts("confirmReset", { city: base.name })) && onReset()}>
        {ts("reset", { city: base.name })}
      </button>
    </section>
  );
}

/* ───────────── Accommodation ───────────── */

export function AccommodationPanel({
  accommodation,
  stayAreas,
  baseName,
  center,
  busy,
  onSave,
  onShowArea,
}: {
  accommodation: TripPreferences["accommodation"];
  stayAreas: StayArea[];
  baseName: string;
  center: { lat: number; lng: number };
  busy: boolean;
  onSave: (a: { status: "booked" | "recommend"; name?: string | null; address?: string | null; lat?: number | null; lng?: number | null }) => void;
  onShowArea: (a: StayArea) => void;
}) {
  const tst = useTranslations("stay");
  const locale = useLocale();
  const booked = accommodation?.status === "booked" && accommodation.name;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(accommodation?.name ?? "");
  const [address, setAddress] = useState(accommodation?.address ?? "");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(accommodation?.lat != null && accommodation?.lng != null ? { lat: Number(accommodation.lat), lng: Number(accommodation.lng) } : null);

  return (
    <section className="plan-card" aria-labelledby="stay-title">
      <h3 id="stay-title" className="plan-card__title"><Icon name="bed" />{tst("title")}</h3>
      {booked && !editing ? (
        <div className="stack" style={{ gap: 6 }}>
          <p style={{ margin: 0 }}><strong>{accommodation.name}</strong>{accommodation.address ? <><br /><span className="small muted">{accommodation.address}</span></> : null}</p>
          <p className="small muted" style={{ margin: 0 }}>{accommodation.lat != null ? tst("usedAsStart") : tst("noPin")}</p>
          <div className="cluster" style={{ gap: 6 }}>
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => setEditing(true)}><Icon name="edit" />{tst("change")}</button>
            <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => onSave({ status: "recommend" })}>{tst("clear")}</button>
          </div>
        </div>
      ) : null}
      {!booked && !editing ? (
        <button type="button" className="btn btn--sm btn--primary" onClick={() => setEditing(true)}><Icon name="plus" />{tst("addBooked", { city: baseName })}</button>
      ) : null}
      {editing ? (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setEditing(false);
            onSave({ status: "booked", name, address, lat: point?.lat ?? null, lng: point?.lng ?? null });
          }}
        >
          <div className="field">
            <label htmlFor="acc-name">{tst("name")}</label>
            <input id="acc-name" className="input" value={name} maxLength={140} required onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="acc-address">{tst("address")}</label>
            <input id="acc-address" className="input" value={address} maxLength={240} autoComplete="street-address" onChange={(e) => setAddress(e.target.value)} />
          </div>
          <p className="small muted" style={{ margin: 0 }}>{tst("pinHint")}</p>
          <LocationPicker center={point ?? center} value={point} onChange={setPoint} />
          <p className="small muted" style={{ margin: 0 }}>{tst("reorganizeNote")}</p>
          <div className="cluster" style={{ gap: 6 }}>
            <button type="submit" className="btn btn--primary btn--sm" disabled={busy || !name.trim()}>{tst("save")}</button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditing(false)}>{tst("cancel")}</button>
          </div>
        </form>
      ) : null}

      {stayAreas.length ? (
        <div className="stack" style={{ gap: 12, marginBlockStart: 8 }}>
          {stayAreas.map((a) => (
            <div key={a.destinationId} className="stay-area">
              <p style={{ margin: 0 }}>
                {a.area && a.sights > 0
                  ? tst.rich("areaSuggestion", { city: a.city, area: a.area, n: a.sights, b: (c) => <strong>{c}</strong> })
                  : a.sights > 0
                    ? tst("cityCentre", { city: a.city, n: a.sights })
                    : tst("cityOnly", { city: a.city })}
              </p>
              {a.checkIn && a.checkOut ? <p className="small muted" style={{ margin: 0 }}>{tst("dates", { from: formatDate(a.checkIn, locale), to: formatDate(a.checkOut, locale) })}</p> : null}
              <div className="link-list">
                <button type="button" className="ext-link" onClick={() => onShowArea(a)}><Icon name="map" />{tst("showArea")}</button>
              </div>
              <OutboundLinks links={a.links.slice(0, 4)} />
            </div>
          ))}
          <p className="small muted" style={{ margin: 0 }}>{tst("areaNote")} <PartnerDisclosure links={stayAreas.flatMap((x) => x.links.slice(0, 4))} /></p>
        </div>
      ) : null}
    </section>
  );
}

/* ───────────── Journey stop body ───────────── */

export function JourneyDetails({ info, linkUrl }: { info: IntercityDetails; linkUrl: string | null }) {
  const tj = useTranslations("journey");
  const tn = useTranslations("nearby");
  const locale = useLocale();
  const rome2rio = `https://www.rome2rio.com/s/${encodeURIComponent(info.from)}/${encodeURIComponent(info.to)}`;
  return (
    <div className="journey">
      <p className="journey__title">
        <Icon name={MODE_ICON[info.mode]} />
        <strong>{tj(`title.${info.direction}`, { mode: tn(`modes.${info.mode}`), from: info.from, to: info.to })}</strong>
      </p>
      <p className="small" style={{ margin: 0 }}>
        {tj(info.source === "curated" ? "typical" : "estimate", { time: formatDuration(info.minutes, locale) })}
        {info.mode !== "car" ? ` · ${info.direct ? tn("direct") : tn("withChange")}` : ""}
        {info.distanceKm ? ` · ${tj("distance", { km: info.distanceKm })}` : ""}
        {info.note ? ` · ${info.note}` : ""}
      </p>
      <p className="small muted" style={{ margin: 0 }}>{tj("checkNote")}</p>
      <div className="link-list">
        {linkUrl ? <a className="ext-link" href={linkUrl} target="_blank" rel="noopener noreferrer">{tj("googleMaps")}<Icon name="external" className="flip-rtl" /></a> : null}
        <a className="ext-link" href={rome2rio} target="_blank" rel="noopener noreferrer nofollow">Rome2Rio<Icon name="external" className="flip-rtl" /></a>
      </div>
    </div>
  );
}
