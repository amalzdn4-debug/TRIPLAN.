"use client";

import dynamic from "next/dynamic";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { createTripAction } from "@/actions/trips";
import { Field, FormMessage, SubmitButton, useFieldError, Notice } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { INTERESTS, FOOD_PREFS, TRANSPORT_PREFS, BUDGET_CATEGORIES, TRAVEL_STYLES, type Interest, type FoodPref } from "@/lib/itinerary/types";
import { ChipGroup, ChoiceCards, Counter } from "./Inputs";
import { useDraft } from "./useDraft";
import { CURRENCIES, todayPlus, type PlannerDestination } from "./shared";
import type { ActionState } from "@/lib/validation";

const LocationPicker = dynamic(() => import("@/components/map/LocationPicker").then((m) => m.LocationPicker), { ssr: false, loading: () => <div style={{ blockSize: 260, borderRadius: 12, background: "var(--tp-blue-100)" }} /> });

const action = createTripAction.bind(null, "detailed");
const STEPS = ["basics", "budget", "stay", "interests", "food", "rhythm", "review"] as const;
type Step = (typeof STEPS)[number];

/** Which wizard step owns each server-side field (to jump back to errors). */
const FIELD_STEP: Record<string, Step> = {
  destination: "basics", departureCity: "basics", startDate: "basics", endDate: "basics", departureTime: "basics", returnTime: "basics", adults: "basics", children: "basics",
  budgetTotal: "budget", budgetPerPerson: "budget", currency: "budget", budgetAccommodation: "budget", budgetFood: "budget", budgetActivities: "budget", budgetTransport: "budget",
  accommodationName: "stay", accommodationAddress: "stay", accommodationLat: "stay", accommodationLng: "stay",
  dietaryNotes: "food",
};

export function DetailedTripWizard({ destinations, defaults, aiEnabled }: { destinations: (PlannerDestination & { lat: number; lng: number })[]; defaults: { destination?: string; currency: string }; aiEnabled: boolean }) {
  const t = useTranslations("planner");
  const format = useFormatter();
  const [state, formAction] = useActionState(action, { ok: false } as ActionState);
  const err = useFieldError(state);
  const [step, setStep] = useState<Step>("basics");
  const [visited, setVisited] = useState<Set<Step>>(new Set(["basics"]));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const panel = useRef<HTMLDivElement>(null);

  const base = {
    destination: "",
    departureCity: "",
    startDate: todayPlus(45),
    endDate: todayPlus(49),
    departureTime: "",
    returnTime: "",
    adults: 2,
    children: 0,
    companions: "couple" as "solo" | "couple" | "family" | "friends" | "business",
    participants: [] as { name: string; isChild: boolean }[],
    budgetTotal: "",
    budgetPerPerson: "",
    currency: defaults.currency,
    budgetCategory: "mid" as (typeof BUDGET_CATEGORIES)[number],
    budgetAccommodation: "",
    budgetFood: "",
    budgetActivities: "",
    budgetTransport: "",
    accommodationStatus: "recommend" as "booked" | "recommend" | "compare",
    accommodationName: "",
    accommodationAddress: "",
    accommodationLat: "" as string | number,
    accommodationLng: "" as string | number,
    accommodationTypes: ["hotel", "apartment"] as string[],
    interests: ["culture", "food", "local"] as Interest[],
    foodPrefs: [] as FoodPref[],
    dietaryNotes: "",
    pace: "balanced" as (typeof TRAVEL_STYLES)[number],
    morning: "relaxed" as "early" | "relaxed",
    dayLength: "flexible" as "full" | "flexible",
    activityBalance: "balanced" as "more_activities" | "balanced" | "more_free_time",
    walking: "medium" as "low" | "medium" | "high",
    transport: "public" as (typeof TRANSPORT_PREFS)[number],
  };
  const overrides = defaults.destination ? { destination: defaults.destination } : {};
  const { value: v, update } = useDraft("detailed", base, overrides);
  const dest = destinations.find((d) => d.slug === v.destination);
  const idx = STEPS.indexOf(step);

  // Server errors → jump to the first step that has one.
  useEffect(() => {
    const keys = Object.keys(state.errors ?? {});
    if (keys.length) {
      const first = STEPS.find((s) => keys.some((k) => (FIELD_STEP[k] ?? "review") === s));
      if (first) setStep(first);
    }
  }, [state]);

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [step]);

  function validate(s: Step): boolean {
    const e: Record<string, string> = {};
    if (s === "basics") {
      if (!v.destination) e.destination = "required";
      if (!v.startDate) e.startDate = "required";
      if (!v.endDate) e.endDate = "required";
      if (v.startDate && v.endDate && v.endDate < v.startDate) e.endDate = "dateOrder";
    }
    if (s === "stay" && v.accommodationStatus === "booked" && !v.accommodationName.trim()) e.accommodationName = "required";
    setLocalErrors(e);
    return Object.keys(e).length === 0;
  }
  const te = useTranslations("errors");
  const fieldErr = (name: string) => (localErrors[name] ? te(localErrors[name]) : err(name));

  function go(to: Step) {
    if (STEPS.indexOf(to) > idx && !validate(step)) return;
    setVisited((s) => new Set(s).add(to));
    setStep(to);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  const nights = useMemo(() => {
    if (!v.startDate || !v.endDate) return 0;
    return Math.max(0, Math.round((Date.parse(v.endDate) - Date.parse(v.startDate)) / 86_400_000));
  }, [v.startDate, v.endDate]);

  const summary: { label: string; value: string; step: Step }[] = [
    { label: t("destination"), value: dest ? `${dest.city}, ${dest.country}` : "—", step: "basics" },
    { label: t("dates"), value: v.startDate && v.endDate ? `${format.dateTime(new Date(v.startDate + "T12:00:00Z"), { dateStyle: "medium" })} → ${format.dateTime(new Date(v.endDate + "T12:00:00Z"), { dateStyle: "medium" })} (${t("nights", { n: nights })})` : "—", step: "basics" },
    { label: t("travellers"), value: `${t("adultsCount", { n: v.adults })}${v.children ? `, ${t("childrenCount", { n: v.children })}` : ""} · ${t(`companionOptions.${v.companions}`)}`, step: "basics" },
    { label: t("departureCity"), value: v.departureCity || "—", step: "basics" },
    { label: t("budget"), value: `${v.budgetTotal ? format.number(Number(v.budgetTotal), { style: "currency", currency: v.currency, maximumFractionDigits: 0 }) : t("notSet")} · ${t(`budgetCategories.${v.budgetCategory}`)}`, step: "budget" },
    { label: t("stay"), value: v.accommodationStatus === "booked" ? `${v.accommodationName}${v.accommodationAddress ? ` — ${v.accommodationAddress}` : ""}` : t(`accommodationOptions.${v.accommodationStatus}`), step: "stay" },
    { label: t("interests"), value: v.interests.map((i) => t(`interestOptions.${i}`)).join(", ") || "—", step: "interests" },
    { label: t("food"), value: [...v.foodPrefs.map((f) => t(`foodOptions.${f}`)), v.dietaryNotes].filter(Boolean).join(", ") || "—", step: "food" },
    { label: t("rhythm"), value: [t(`paces.${v.pace}`), t(`morningOptions.${v.morning}`), t(`walkingOptions.${v.walking}`), t(`transportOptions.${v.transport}`)].join(" · "), step: "rhythm" },
  ];

  return (
    <div className="planner">
      <ol className="wizard-steps" aria-label={t("steps")}>
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" aria-current={s === step ? "step" : undefined} className={visited.has(s) && s !== step ? "is-done" : ""} onClick={() => (visited.has(s) || i <= idx ? go(s) : undefined)} disabled={!visited.has(s) && i > idx + 1}>
              <span className="num">{visited.has(s) && s !== step && i < idx ? <Icon name="check" style={{ inlineSize: 14 }} /> : i + 1}</span>
              {t(`stepNames.${s}`)}
            </button>
          </li>
        ))}
      </ol>

      <div ref={panel}>
        <div className="progress" aria-hidden>
          <span style={{ inlineSize: `${((idx + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="wizard-panel form">
          <p className="small muted" style={{ margin: 0 }}>{t("stepOf", { n: idx + 1, total: STEPS.length })}</p>
          <h2 tabIndex={-1}>{t(`stepTitles.${step}`)}</h2>

          {step === "basics" && (
            <>
              <div className="form-row">
                <Field label={t("destination")} name="destination" error={fieldErr("destination")}>
                  {(p) => (
                    <select {...p} className="select" value={v.destination} onChange={(e) => update("destination", e.target.value)}>
                      <option value="">{t("chooseDestination")}</option>
                      {destinations.map((d) => (
                        <option key={d.slug} value={d.slug}>{d.city}, {d.country}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label={t("departureCity")} name="departureCity" error={fieldErr("departureCity")} hint={t("departureHint")}>
                  {(p) => <input {...p} className="input" value={v.departureCity} onChange={(e) => update("departureCity", e.target.value)} />}
                </Field>
              </div>
              {dest && dest.placeCount === 0 ? <Notice tone="warning">{t("limitedData", { city: dest.city })}</Notice> : null}
              <div className="form-row">
                <Field label={t("arrivalDate")} name="startDate" error={fieldErr("startDate")}>
                  {(p) => <input {...p} className="input" type="date" min={todayPlus(0)} value={v.startDate} onChange={(e) => update("startDate", e.target.value)} />}
                </Field>
                <Field label={t("arrivalTime")} name="departureTime" error={fieldErr("departureTime")} hint={t("optional")}>
                  {(p) => <input {...p} className="input" type="time" value={v.departureTime} onChange={(e) => update("departureTime", e.target.value)} />}
                </Field>
                <Field label={t("departureDate")} name="endDate" error={fieldErr("endDate")}>
                  {(p) => <input {...p} className="input" type="date" min={v.startDate} value={v.endDate} onChange={(e) => update("endDate", e.target.value)} />}
                </Field>
                <Field label={t("returnTime")} name="returnTime" error={fieldErr("returnTime")} hint={t("optional")}>
                  {(p) => <input {...p} className="input" type="time" value={v.returnTime} onChange={(e) => update("returnTime", e.target.value)} />}
                </Field>
              </div>
              <div className="form-row">
                <Counter label={t("adults")} name="adults_ui" value={v.adults} min={1} max={20} onChange={(n) => update("adults", n)} />
                <Counter label={t("children")} name="children_ui" value={v.children} min={0} max={20} onChange={(n) => update("children", n)} />
              </div>
              <ChoiceCards legend={t("companions")} name="companions_ui" options={["solo", "couple", "family", "friends", "business"] as const} value={v.companions} onChange={(x) => update("companions", x)} labelFor={(o) => t(`companionOptions.${o}`)} />
              <fieldset>
                <legend>{t("participants")}</legend>
                <p className="field-hint" style={{ marginBlockEnd: 8 }}>{t("participantsHint")}</p>
                <div className="stack" style={{ gap: 8 }}>
                  {v.participants.map((p, i) => (
                    <div key={i} className="cluster">
                      <label className="visually-hidden" htmlFor={`pp-${i}`}>{t("participantName")}</label>
                      <input id={`pp-${i}`} className="input" style={{ flex: "1 1 200px" }} value={p.name} maxLength={80} onChange={(e) => update("participants", v.participants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <label className="checkbox">
                        <input type="checkbox" checked={p.isChild} onChange={(e) => update("participants", v.participants.map((x, j) => (j === i ? { ...x, isChild: e.target.checked } : x)))} />
                        <span>{t("isChild")}</span>
                      </label>
                      <button type="button" className="btn btn--icon btn--ghost" aria-label={t("removeParticipant")} onClick={() => update("participants", v.participants.filter((_, j) => j !== i))}>
                        <Icon name="trash" />
                      </button>
                    </div>
                  ))}
                  {v.participants.length < 20 ? (
                    <button type="button" className="btn btn--sm" style={{ justifySelf: "start" }} onClick={() => update("participants", [...v.participants, { name: "", isChild: false }])}>
                      <Icon name="plus" />
                      {t("addParticipant")}
                    </button>
                  ) : null}
                </div>
              </fieldset>
            </>
          )}

          {step === "budget" && (
            <>
              <div className="form-row">
                <Field label={t("budgetTotal")} name="budgetTotal" error={fieldErr("budgetTotal")} hint={t("optional")}>
                  {(p) => <input {...p} className="input" type="number" min={0} inputMode="decimal" value={v.budgetTotal} onChange={(e) => update("budgetTotal", e.target.value)} />}
                </Field>
                <Field label={t("budgetPerPerson")} name="budgetPerPerson" error={fieldErr("budgetPerPerson")} hint={t("optional")}>
                  {(p) => <input {...p} className="input" type="number" min={0} inputMode="decimal" value={v.budgetPerPerson} onChange={(e) => update("budgetPerPerson", e.target.value)} />}
                </Field>
                <Field label={t("currency")} name="currency" error={fieldErr("currency")}>
                  {(p) => (
                    <select {...p} className="select" value={v.currency} onChange={(e) => update("currency", e.target.value)}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </Field>
              </div>
              <ChoiceCards legend={t("budgetCategory")} name="budgetCategory_ui" options={BUDGET_CATEGORIES} value={v.budgetCategory} onChange={(x) => update("budgetCategory", x)} labelFor={(o) => t(`budgetCategories.${o}`)} />
              <fieldset>
                <legend>{t("budgetSplit")}</legend>
                <div className="form-row">
                  {(["budgetAccommodation", "budgetFood", "budgetActivities", "budgetTransport"] as const).map((k) => (
                    <Field key={k} label={t(`split.${k}`)} name={k} error={fieldErr(k)}>
                      {(p) => <input {...p} className="input" type="number" min={0} inputMode="decimal" value={v[k]} onChange={(e) => update(k, e.target.value)} />}
                    </Field>
                  ))}
                </div>
              </fieldset>
              <p className="small muted">{t("budgetDisclaimer")}</p>
            </>
          )}

          {step === "stay" && (
            <>
              <ChoiceCards legend={t("accommodationQuestion")} name="accommodationStatus_ui" options={["booked", "recommend", "compare"] as const} value={v.accommodationStatus} onChange={(x) => update("accommodationStatus", x)} labelFor={(o) => t(`accommodationOptions.${o}`)} hintFor={(o) => t(`accommodationHints.${o}`)} />
              {v.accommodationStatus === "booked" ? (
                <>
                  <div className="form-row">
                    <Field label={t("accommodationName")} name="accommodationName" error={fieldErr("accommodationName")}>
                      {(p) => <input {...p} className="input" value={v.accommodationName} onChange={(e) => update("accommodationName", e.target.value)} />}
                    </Field>
                    <Field label={t("accommodationAddress")} name="accommodationAddress" error={fieldErr("accommodationAddress")}>
                      {(p) => <input {...p} className="input" value={v.accommodationAddress} onChange={(e) => update("accommodationAddress", e.target.value)} autoComplete="street-address" />}
                    </Field>
                  </div>
                  {dest ? (
                    <LocationPicker
                      center={{ lat: dest.lat, lng: dest.lng }}
                      value={v.accommodationLat !== "" && v.accommodationLng !== "" ? { lat: Number(v.accommodationLat), lng: Number(v.accommodationLng) } : null}
                      onChange={(p) => {
                        update("accommodationLat", p.lat);
                        update("accommodationLng", p.lng);
                      }}
                    />
                  ) : null}
                  <div className="form-row">
                    <Field label={t("latitude")} name="accommodationLat" error={fieldErr("accommodationLat")}>
                      {(p) => <input {...p} className="input ltr" inputMode="decimal" value={v.accommodationLat} onChange={(e) => update("accommodationLat", e.target.value)} />}
                    </Field>
                    <Field label={t("longitude")} name="accommodationLng" error={fieldErr("accommodationLng")}>
                      {(p) => <input {...p} className="input ltr" inputMode="decimal" value={v.accommodationLng} onChange={(e) => update("accommodationLng", e.target.value)} />}
                    </Field>
                  </div>
                </>
              ) : (
                <ChipGroup legend={t("accommodationTypes")} name="accommodationTypes_ui" options={["hotel", "apartment", "hostel", "guesthouse", "resort"] as const} value={v.accommodationTypes as ("hotel" | "apartment" | "hostel" | "guesthouse" | "resort")[]} onChange={(x) => update("accommodationTypes", x)} labelFor={(o) => t(`accommodationTypeOptions.${o}`)} />
              )}
            </>
          )}

          {step === "interests" && (
            <ChipGroup legend={t("interestsQuestion")} name="interests_ui" options={INTERESTS} value={v.interests} onChange={(x) => update("interests", x)} labelFor={(o) => t(`interestOptions.${o}`)} />
          )}

          {step === "food" && (
            <>
              <ChipGroup legend={t("foodQuestion")} name="foodPrefs_ui" options={FOOD_PREFS} value={v.foodPrefs} onChange={(x) => update("foodPrefs", x)} labelFor={(o) => t(`foodOptions.${o}`)} />
              <Field label={t("dietaryNotes")} name="dietaryNotes" error={fieldErr("dietaryNotes")} hint={t("dietaryHint")}>
                {(p) => <textarea {...p} className="textarea" maxLength={300} value={v.dietaryNotes} onChange={(e) => update("dietaryNotes", e.target.value)} />}
              </Field>
              <Notice>{t("halalNote")}</Notice>
            </>
          )}

          {step === "rhythm" && (
            <>
              <ChoiceCards legend={t("pace")} name="pace_ui" options={TRAVEL_STYLES} value={v.pace} onChange={(x) => update("pace", x)} labelFor={(o) => t(`paces.${o}`)} hintFor={(o) => t(`paceHints.${o}`)} />
              <ChoiceCards legend={t("morning")} name="morning_ui" options={["early", "relaxed"] as const} value={v.morning} onChange={(x) => update("morning", x)} labelFor={(o) => t(`morningOptions.${o}`)} />
              <ChoiceCards legend={t("dayLength")} name="dayLength_ui" options={["full", "flexible"] as const} value={v.dayLength} onChange={(x) => update("dayLength", x)} labelFor={(o) => t(`dayLengthOptions.${o}`)} />
              <ChoiceCards legend={t("activityBalance")} name="activityBalance_ui" options={["more_activities", "balanced", "more_free_time"] as const} value={v.activityBalance} onChange={(x) => update("activityBalance", x)} labelFor={(o) => t(`balanceOptions.${o}`)} />
              <ChoiceCards legend={t("walking")} name="walking_ui" options={["low", "medium", "high"] as const} value={v.walking} onChange={(x) => update("walking", x)} labelFor={(o) => t(`walkingOptions.${o}`)} />
              <ChoiceCards legend={t("transport")} name="transport_ui" options={TRANSPORT_PREFS} value={v.transport} onChange={(x) => update("transport", x)} labelFor={(o) => t(`transportOptions.${o}`)} />
            </>
          )}

          {step === "review" && (
            <form action={formAction} className="form" noValidate>
              <FormMessage state={state} />
              {state.errors ? <Notice tone="danger">{t("fixErrors")}</Notice> : null}
              <dl className="summary-list" style={{ margin: 0 }}>
                {summary.map((s) => (
                  <div key={s.label} className="summary-item">
                    <dt>{s.label}</dt>
                    <dd>{s.value}</dd>
                    <button type="button" className="btn btn--sm btn--ghost" onClick={() => go(s.step)}>
                      <Icon name="edit" />
                      {t("edit")}
                    </button>
                  </div>
                ))}
              </dl>
              {/* Everything is submitted from state; the server re-validates all of it. */}
              {Object.entries(v).map(([k, val]) => {
                if (k === "participants") return <input key={k} type="hidden" name="participantsJson" value={JSON.stringify(val)} />;
                if (Array.isArray(val)) return val.map((x) => <input key={`${k}-${x}`} type="hidden" name={k} value={String(x)} />);
                return <input key={k} type="hidden" name={k} value={String(val ?? "")} />;
              })}
              <p className="small muted">{aiEnabled ? t("aiNote") : t("rulesNote")}</p>
              <div className="wizard-footer" style={{ marginBlockStart: 0 }}>
                <button type="button" className="btn" onClick={() => go(STEPS[idx - 1])}>
                  <Icon name="arrowLeft" className="flip-rtl" />
                  {t("back")}
                </button>
                <SubmitButton className="btn btn--primary btn--lg" pendingLabel={t("generating")}>
                  <Icon name="sparkles" />
                  {t("generate")}
                </SubmitButton>
              </div>
            </form>
          )}

          {step !== "review" ? (
            <div className="wizard-footer">
              {idx > 0 ? (
                <button type="button" className="btn" onClick={() => go(STEPS[idx - 1])}>
                  <Icon name="arrowLeft" className="flip-rtl" />
                  {t("back")}
                </button>
              ) : (
                <span />
              )}
              <button type="button" className="btn btn--primary" onClick={() => go(STEPS[idx + 1])}>
                {t("next")}
                <Icon name="arrowRight" className="flip-rtl" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
