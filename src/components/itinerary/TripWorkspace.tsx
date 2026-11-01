"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { formatDate, formatDistance, formatDuration, formatMoney, formatTime } from "@/lib/format";
import { googleMapsDirectionsUrl, googleMapsPlaceUrl } from "@/lib/geo";
import { restaurantSearchUrl } from "@/lib/links";
import type { DayView, StopView, TripView } from "@/lib/trips";
import type { MapStop } from "@/components/map/TripMap";
import {
  addCustomStopAction,
  addPlaceStopAction,
  deleteTripAction,
  duplicateTripAction,
  moveStopAction,
  regenerateDayAction,
  regenerateTripAction,
  removeStopAction,
  reorderStopsAction,
  replaceStopAction,
  toggleLockAction,
  updateStopAction,
  updateTripMetaAction,
} from "@/actions/trips";

const TripMap = dynamic(() => import("@/components/map/TripMap").then((m) => m.TripMap), { ssr: false, loading: () => <div className="map-fallback" /> });
const LocationPicker = dynamic(() => import("@/components/map/LocationPicker").then((m) => m.LocationPicker), { ssr: false });

export interface CandidateOption {
  id: string;
  name: string;
  kind: string;
  neighborhood: string | null;
  verification: string;
}

const MODE_ICON = { walking: "walk", transit: "bus", driving: "car", cycling: "bike" } as const;
const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

export function TripWorkspace({
  initialTrip,
  candidates,
  center,
  externalLinks,
  timeFormat,
  units,
}: {
  initialTrip: TripView;
  candidates: CandidateOption[];
  center: { lat: number; lng: number };
  externalLinks: { category: string; provider: string; url: string }[];
  timeFormat: "auto" | "12h" | "24h";
  units: "metric" | "imperial";
}) {
  const t = useTranslations("itinerary");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [trip, setTrip] = useState(initialTrip);
  const [dayIdx, setDayIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState(trip.title);
  const listRef = useRef<HTMLDivElement>(null);
  const day: DayView | undefined = trip.days[Math.min(dayIdx, trip.days.length - 1)];
  const prefs = trip.preferences;
  const home = prefs?.accommodation?.lat != null && prefs?.accommodation?.lng != null ? { lat: Number(prefs.accommodation.lat), lng: Number(prefs.accommodation.lng), label: prefs.accommodation.name || t("accommodation") } : null;

  // Clear planner drafts once a trip exists.
  useEffect(() => {
    try {
      sessionStorage.removeItem("triplan:draft:fast");
      sessionStorage.removeItem("triplan:draft:detailed");
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const run = useCallback(
    (fn: () => Promise<TripView | null | { trip: TripView | null; replaced: boolean }>, success?: string) => {
      start(async () => {
        try {
          const res = await fn();
          const next = res && "trip" in res ? res.trip : res;
          if (res && "replaced" in res && !res.replaced) setToast(t("noAlternative"));
          else if (success) setToast(success);
          if (next) setTrip(next as TripView);
        } catch {
          setToast(t("actionFailed"));
        }
      });
    },
    [t],
  );

  // Numbering of located stops (same numbers on list & map).
  const numbering = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const s of day?.stops ?? []) if (s.lat != null && s.lng != null) m.set(s.id, ++n);
    return m;
  }, [day]);

  const mapStops: MapStop[] = useMemo(
    () =>
      (day?.stops ?? [])
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => ({ id: s.id, n: numbering.get(s.id)!, lat: s.lat!, lng: s.lng!, title: stopLabel(s), kind: s.kind, time: s.startTime ? formatTime(s.startTime, locale, timeFormat) : null })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day, numbering, locale, timeFormat],
  );

  function stopLabel(s: StopView): string {
    if ((s.kind === "meal" || s.kind === "break") && s.mealType && !s.placeId) return s.title ? t("mealNear", { meal: t(`meals.${s.mealType}`), place: s.title }) : t(`meals.${s.mealType}`);
    if (s.kind === "meal" && s.mealType) return `${t(`meals.${s.mealType}`)} · ${s.title}`;
    if (s.kind === "break" && !s.mealType) return s.title ? t("freeTimeNear", { place: s.title }) : t("freeTime");
    return s.title;
  }

  const selectStop = useCallback((id: string) => {
    setSelected(id);
    const node = listRef.current?.querySelector<HTMLElement>(`[data-stop="${id}"]`);
    if (node) {
      node.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      if (window.matchMedia("(max-width: 980px)").matches) setShowMap(false);
    }
  }, []);

  function reorder(ids: string[]) {
    if (!day) return;
    // Optimistic update, then server reschedules times & legs.
    const byId = new Map(day.stops.map((s) => [s.id, s]));
    setTrip((tr) => ({ ...tr, days: tr.days.map((d) => (d.id === day.id ? { ...d, stops: ids.map((id) => byId.get(id)!).filter(Boolean) } : d)) }));
    run(() => reorderStopsAction(trip.id, day.id, ids));
  }
  function move(id: string, delta: number) {
    if (!day) return;
    const ids = day.stops.map((s) => s.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder(ids);
  }
  function onDrop(targetId: string) {
    if (!day || !dragId || dragId === targetId) return;
    const ids = day.stops.map((s) => s.id).filter((x) => x !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setDragId(null);
    setOverId(null);
    reorder(ids);
  }

  const usedPlaceIds = new Set(trip.days.flatMap((d) => d.stops.map((s) => s.placeId)).filter(Boolean));
  const dayRouteUrl = googleMapsDirectionsUrl(
    [...(home ? [home] : []), ...mapStops.map((s) => ({ lat: s.lat, lng: s.lng }))],
    prefs?.transport === "driving" ? "driving" : prefs?.transport === "cycling" ? "cycling" : prefs?.transport === "walking" ? "walking" : "transit",
  );
  const estimateLegs = day?.stops.some((s) => s.travelSource === "estimate");

  if (!trip.days.length) {
    return (
      <section className="section" style={{ paddingBlockStart: "calc(var(--header-h) + 4rem)" }}>
        <div className="container container--narrow empty">
          <h1>{trip.title}</h1>
          <p className="muted">{t("notGenerated")}</p>
          <button type="button" className="btn btn--primary" disabled={pending} onClick={() => run(() => regenerateTripAction(trip.id), t("generated"))}>
            {pending ? <span className="spinner" /> : <Icon name="sparkles" />}
            {t("generateNow")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className={`workspace ${showMap ? "show-map" : ""}`}>
      <div className="workspace__list" ref={listRef} style={{ position: "relative" }}>
        <div className="workspace__head stack" style={{ gap: 12 }}>
          <Link href="/trips" className="back-link">
            <Icon name="arrowLeft" className="flip-rtl" style={{ inlineSize: 14, blockSize: 14 }} /> {t("backToTrips")}
          </Link>
          <div className="title-edit">
            <label htmlFor="trip-title" className="visually-hidden">{t("tripTitle")}</label>
            <input
              id="trip-title"
              className="input"
              value={title}
              maxLength={140}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title !== trip.title && run(() => updateTripMetaAction(trip.id, { title }), t("saved"))}
              style={{ border: "1px solid transparent", paddingInline: 8, minBlockSize: 44, background: "transparent" }}
            />
          </div>
          <div className="meta-line">
            <span><Icon name="pin" />{trip.destinationName}</span>
            {trip.startDate ? <span><Icon name="calendar" />{formatDate(trip.startDate, locale)} – {formatDate(trip.endDate, locale)}</span> : null}
            <span><Icon name="users" />{t("travellers", { n: trip.adults + trip.children })}</span>
            <span className="badge badge--outline">{trip.generationSource === "ai" ? t("sourceAi") : t("sourceRules")}</span>
          </div>
          <div className="cluster" style={{ gap: 8 }}>
            <label className="visually-hidden" htmlFor="trip-status">{t("status")}</label>
            <select id="trip-status" className="select" style={{ inlineSize: "auto", minBlockSize: 36, paddingBlock: 4, fontSize: 14 }} value={trip.status} onChange={(e) => run(() => updateTripMetaAction(trip.id, { status: e.target.value as TripView["status"] }), t("saved"))}>
              {(["draft", "planned", "completed"] as const).map((s) => <option key={s} value={s}>{t(`statuses.${s}`)}</option>)}
            </select>
            <button type="button" className="btn btn--sm" disabled={pending} onClick={() => confirm(t("confirmRegenerateTrip")) && run(() => regenerateTripAction(trip.id), t("regenerated"))}>
              <Icon name="refresh" />{t("regenerateTrip")}
            </button>
            <button type="button" className="btn btn--sm" disabled={pending} onClick={() => start(() => duplicateTripAction(trip.id))}>
              <Icon name="copy" />{t("duplicate")}
            </button>
            <button type="button" className="btn btn--sm btn--danger" disabled={pending} onClick={() => confirm(t("confirmDelete")) && start(() => deleteTripAction(trip.id))}>
              <Icon name="trash" />{t("delete")}
            </button>
          </div>
          <details>
            <summary className="small" style={{ cursor: "pointer", fontWeight: 600, color: "var(--color-heading)" }}>{t("bookingLinks")}</summary>
            <div className="stack" style={{ marginBlockStart: 12 }}>
              {(["accommodation", "flights", "activities", "luggage", "transport"] as const).map((cat) => (
                <div key={cat}>
                  <p className="small muted" style={{ marginBlockEnd: 6 }}>{t(`linkCategories.${cat}`)}</p>
                  <div className="link-list">
                    {externalLinks.filter((l) => l.category === cat).map((l) => (
                      <a key={l.provider} className="ext-link" href={l.url} target="_blank" rel="noopener noreferrer nofollow">{l.provider}<Icon name="external" className="flip-rtl" /></a>
                    ))}
                  </div>
                </div>
              ))}
              <p className="small muted">{t("externalNote")} {tc("affiliateDisclosure")}</p>
            </div>
          </details>
        </div>

        <div className="day-tabs" role="tablist" aria-label={t("days")}>
          {trip.days.map((d, i) => (
            <button key={d.id} type="button" role="tab" className="day-tab" aria-selected={i === dayIdx} aria-controls="day-panel" onClick={() => { setDayIdx(i); setSelected(null); }}>
              <strong>{t("dayN", { n: i + 1 })}</strong>
              {d.date ? formatDate(d.date, locale, { weekday: "short", day: "numeric", month: "short" }) : null}
            </button>
          ))}
        </div>

        {day ? (
          <div className="day-body" id="day-panel" role="tabpanel">
            <div className="day-head">
              <div>
                <h2>{day.title}</h2>
                <p className="small muted" style={{ margin: 0 }}>
                  {day.date ? formatDate(day.date, locale, { weekday: "long", day: "numeric", month: "long" }) : null}
                </p>
              </div>
              <div className="cluster" style={{ gap: 6 }}>
                <button type="button" className="btn btn--sm" disabled={pending} onClick={() => run(() => regenerateDayAction(trip.id, day.id), t("dayRegenerated"))}>
                  <Icon name="shuffle" />{t("regenerateDay")}
                </button>
                {dayRouteUrl ? (
                  <a className="btn btn--sm" href={dayRouteUrl} target="_blank" rel="noopener noreferrer">
                    <Icon name="route" />{t("openInMaps")}
                  </a>
                ) : null}
              </div>
            </div>
            <p className="small muted">{t("dragHint")}</p>

            <ol className="timeline">
              {day.stops.map((s, i) => {
                const n = numbering.get(s.id);
                const isMealLike = s.kind === "meal" || (s.kind === "break" && s.mealType);
                const label = stopLabel(s);
                const mealUrl = isMealLike && !s.placeId ? restaurantSearchUrl({ mealType: s.mealType, foodPrefs: prefs?.foodPrefs, near: s.lat != null ? { lat: s.lat, lng: s.lng! } : null, area: s.title, city: trip.destinationName }) : null;
                return (
                  <li
                    key={s.id}
                    data-stop={s.id}
                    className={`stop stop--${s.kind === "meal" ? "meal" : s.kind === "break" ? "break" : "place"} ${selected === s.id ? "is-selected" : ""} ${dragId === s.id ? "is-dragging" : ""} ${overId === s.id ? "is-drop-target" : ""}`}
                    draggable
                    onDragStart={(e) => { setDragId(s.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(e) => { e.preventDefault(); setOverId(s.id); }}
                    onDragLeave={() => setOverId((o) => (o === s.id ? null : o))}
                    onDrop={(e) => { e.preventDefault(); onDrop(s.id); }}
                    onDragEnd={() => { setDragId(null); setOverId(null); }}
                  >
                    <div className="stop__time">{s.startTime ? formatTime(s.startTime, locale, timeFormat) : ""}</div>
                    <div>
                      <div className="stop__card">
                        <div className="stop__row">
                          <button type="button" className="stop__marker" onClick={() => setSelected(s.id)} aria-label={t("showOnMap")}>
                            {n ?? <Icon name={s.kind === "meal" ? "utensils" : s.kind === "break" ? "coffee" : "pin"} />}
                          </button>
                          <div className="stop__main">
                            <button type="button" className="stop__title" onClick={() => setSelected(s.id)} aria-expanded={selected === s.id}>
                              {label}
                            </button>
                            <div className="stop__meta">
                              <span>{formatDuration(s.durationMin, locale)}</span>
                              {s.costMin != null && s.costMax != null && s.costCurrency ? (
                                <span>
                                  {formatMoney(s.costMin, s.costCurrency, locale)}–{formatMoney(s.costMax, s.costCurrency, locale)} {s.costBasis === "per_person" ? t("perPerson") : t("total")} · {s.costStatus === "confirmed" ? t("confirmed") : t("estimated")}
                                </span>
                              ) : s.kind === "attraction" || s.kind === "activity" ? (
                                <span>{t("costUnknown")}</span>
                              ) : null}
                              {s.locked ? <span className="lock-on"><Icon name="lock" style={{ display: "inline", inlineSize: 12, verticalAlign: -1 }} /> {t("locked")}</span> : null}
                            </div>
                            {s.description ? <p className="stop__desc">{s.description}</p> : null}
                            {selected === s.id ? (
                              <div className="stop__actions">
                                {mealUrl ? (
                                  <a className="btn btn--sm btn--gold" href={mealUrl} target="_blank" rel="noopener noreferrer">
                                    <Icon name="search" />{t("findFood", { meal: t(`meals.${s.mealType ?? "lunch"}`) })}
                                  </a>
                                ) : null}
                                {(s.kind === "attraction" || s.kind === "activity" || s.kind === "custom") && s.lat != null ? (
                                  <a className="btn btn--sm" href={googleMapsPlaceUrl(s.title, trip.destinationName)} target="_blank" rel="noopener noreferrer">
                                    <Icon name="external" className="flip-rtl" />{t("details")}
                                  </a>
                                ) : null}
                                {s.linkUrl ? <a className="btn btn--sm" href={s.linkUrl} target="_blank" rel="noopener noreferrer">{s.linkLabel || t("website")}</a> : null}
                                <button type="button" className={`btn btn--sm ${s.locked ? "lock-on" : ""}`} aria-pressed={s.locked} onClick={() => run(() => toggleLockAction(trip.id, s.id, !s.locked))}>
                                  <Icon name={s.locked ? "lock" : "unlock"} />{s.locked ? t("unlock") : t("lock")}
                                </button>
                                {(s.kind === "attraction" || s.kind === "activity") && !s.locked ? (
                                  <button type="button" className="btn btn--sm" disabled={pending} onClick={() => run(() => replaceStopAction(trip.id, s.id), t("replaced"))}>
                                    <Icon name="shuffle" />{t("replace")}
                                  </button>
                                ) : null}
                                <label className="visually-hidden" htmlFor={`dur-${s.id}`}>{t("duration")}</label>
                                <select id={`dur-${s.id}`} className="select" style={{ inlineSize: "auto", minBlockSize: 36, paddingBlock: 4, fontSize: 13 }} value={DURATIONS.includes(s.durationMin) ? s.durationMin : ""} onChange={(e) => run(() => updateStopAction(trip.id, s.id, { durationMin: Number(e.target.value) }))}>
                                  {!DURATIONS.includes(s.durationMin) ? <option value="">{formatDuration(s.durationMin, locale)}</option> : null}
                                  {DURATIONS.map((d) => <option key={d} value={d}>{formatDuration(d, locale)}</option>)}
                                </select>
                                {trip.days.length > 1 ? (
                                  <>
                                    <label className="visually-hidden" htmlFor={`mv-${s.id}`}>{t("moveToDay")}</label>
                                    <select id={`mv-${s.id}`} className="select" style={{ inlineSize: "auto", minBlockSize: 36, paddingBlock: 4, fontSize: 13 }} value="" onChange={(e) => e.target.value && run(() => moveStopAction(trip.id, s.id, e.target.value), t("moved"))}>
                                      <option value="">{t("moveToDay")}</option>
                                      {trip.days.filter((d) => d.id !== day.id).map((d) => <option key={d.id} value={d.id}>{t("dayN", { n: d.dayIndex + 1 })}</option>)}
                                    </select>
                                  </>
                                ) : null}
                                <button type="button" className="btn btn--sm btn--icon" aria-label={t("moveUp")} disabled={i === 0 || pending} onClick={() => move(s.id, -1)}>
                                  <Icon name="chevronDown" style={{ transform: "rotate(180deg)" }} />
                                </button>
                                <button type="button" className="btn btn--sm btn--icon" aria-label={t("moveDown")} disabled={i === day.stops.length - 1 || pending} onClick={() => move(s.id, 1)}>
                                  <Icon name="chevronDown" />
                                </button>
                                <button type="button" className="btn btn--sm btn--danger" disabled={pending || s.locked} onClick={() => run(() => removeStopAction(trip.id, s.id), t("removed"))}>
                                  <Icon name="trash" />{t("remove")}
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <span className="stop__handle" aria-hidden title={t("drag")}>
                            <Icon name="grip" />
                          </span>
                        </div>
                      </div>
                      {s.travelMinutes != null && s.travelMode && i < day.stops.length - 1 && (s.travelMeters ?? 0) >= 40 ? (
                        <p className="leg">
                          <Icon name={MODE_ICON[s.travelMode]} />
                          {t(`modes.${s.travelMode}`)} · {formatDuration(s.travelMinutes, locale)}
                          {s.travelMeters ? ` · ${formatDistance(s.travelMeters, locale, units)}` : ""}
                          {s.travelSource === "estimate" ? ` · ${t("approx")}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
            {estimateLegs ? <p className="small muted">{t("estimateNote")}</p> : null}

            <button type="button" className="btn btn--block" style={{ marginBlockStart: 12 }} onClick={() => setAdding(true)}>
              <Icon name="plus" />{t("addStop")}
            </button>
          </div>
        ) : null}
        {pending ? (
          <div className="busy-overlay" aria-live="polite">
            <span className="spinner" style={{ inlineSize: 28, blockSize: 28, color: "var(--tp-navy)" }} />
            <span className="visually-hidden">{t("working")}</span>
          </div>
        ) : null}
      </div>

      <div className="workspace__map">
        <TripMap stops={mapStops} selectedId={selected} onSelect={selectStop} home={home} center={center} active={showMap} />
      </div>

      <button type="button" className="btn btn--primary workspace__mobile-toggle" onClick={() => setShowMap((m) => !m)} aria-pressed={showMap}>
        <Icon name={showMap ? "calendar" : "map"} />
        {showMap ? t("showList") : t("showMap")}
      </button>

      {adding && day ? (
        <AddStopDialog
          onClose={() => setAdding(false)}
          candidates={candidates.filter((c) => !usedPlaceIds.has(c.id))}
          center={center}
          onAddPlace={(placeId) => { setAdding(false); run(() => addPlaceStopAction(trip.id, day.id, placeId), t("added")); }}
          onAddCustom={(c) => { setAdding(false); run(() => addCustomStopAction(trip.id, day.id, c), t("added")); }}
        />
      ) : null}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}

function AddStopDialog({ onClose, candidates, center, onAddPlace, onAddCustom }: { onClose: () => void; candidates: CandidateOption[]; center: { lat: number; lng: number }; onAddPlace: (id: string) => void; onAddCustom: (c: { title: string; lat: number | null; lng: number | null; durationMin: number }) => void }) {
  const t = useTranslations("itinerary");
  const locale = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"places" | "custom">(candidates.length ? "places" : "custom");
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(60);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    const close = () => onClose();
    d?.addEventListener("close", close);
    return () => d?.removeEventListener("close", close);
  }, [onClose]);
  const list = candidates.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="add-title">
      <div className="dialog__head">
        <h2 id="add-title">{t("addStop")}</h2>
        <button type="button" className="btn btn--icon btn--ghost" aria-label={t("close")} onClick={() => ref.current?.close()}>
          <Icon name="close" />
        </button>
      </div>
      <div className="dialog__body">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "places"} onClick={() => setTab("places")}>{t("fromGuide")}</button>
          <button type="button" role="tab" aria-selected={tab === "custom"} onClick={() => setTab("custom")}>{t("custom")}</button>
        </div>
        {tab === "places" ? (
          <>
            <label className="visually-hidden" htmlFor="add-q">{t("search")}</label>
            <input id="add-q" className="input" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
            {list.length ? (
              <ul className="option-list">
                {list.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => onAddPlace(c.id)}>
                      <span><strong>{c.name}</strong>{c.neighborhood ? <><br /><span className="small muted">{c.neighborhood}</span></> : null}</span>
                      <Icon name="plus" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{t("noCandidates")}</p>
            )}
          </>
        ) : (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onAddCustom({ title: name.trim(), lat: point?.lat ?? null, lng: point?.lng ?? null, durationMin: duration });
            }}
          >
            <div className="field">
              <label htmlFor="custom-name">{t("customName")}</label>
              <input id="custom-name" className="input" value={name} maxLength={140} required onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="custom-dur">{t("duration")}</label>
              <select id="custom-dur" className="select" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATIONS.map((d) => <option key={d} value={d}>{formatDuration(d, locale)}</option>)}
              </select>
            </div>
            <LocationPicker center={center} value={point} onChange={setPoint} />
            <button type="submit" className="btn btn--primary">{t("add")}</button>
          </form>
        )}
      </div>
    </dialog>
  );
}
