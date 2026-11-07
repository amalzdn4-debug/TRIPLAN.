"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createTripAction } from "@/actions/trips";
import { Field, FormMessage, SubmitButton, useFieldError, Notice } from "@/components/ui/Form";
import { INTERESTS, FOOD_PREFS, TRANSPORT_PREFS, BUDGET_CATEGORIES, TRAVEL_STYLES, type Interest, type FoodPref } from "@/lib/itinerary/types";
import { ChipGroup, ChoiceCards, Counter } from "./Inputs";
import { useDraft } from "./useDraft";
import { CURRENCIES, todayPlus, type PlannerDestination } from "./shared";
import type { ActionState } from "@/lib/validation";
import { DateInput } from "./TimeDate";

const action = createTripAction.bind(null, "fast");

export function FastTripForm({ destinations, defaults, aiEnabled }: { destinations: PlannerDestination[]; defaults: { destination?: string; currency: string; startDate?: string; endDate?: string }; aiEnabled: boolean }) {
  const t = useTranslations("planner");
  const [state, formAction] = useActionState(action, { ok: false } as ActionState);
  const err = useFieldError(state);
  const overrides = Object.fromEntries(Object.entries({ destination: defaults.destination, startDate: defaults.startDate, endDate: defaults.endDate }).filter(([, v]) => v)) as Partial<typeof base>;
  const base = {
    destination: "",
    departureCity: "",
    startDate: todayPlus(30),
    endDate: todayPlus(33),
    adults: 2,
    children: 0,
    budgetTotal: "",
    currency: defaults.currency,
    budgetCategory: "mid" as (typeof BUDGET_CATEGORIES)[number],
    pace: "balanced" as (typeof TRAVEL_STYLES)[number],
    interests: ["culture", "food"] as Interest[],
    foodPrefs: [] as FoodPref[],
    transport: "public" as (typeof TRANSPORT_PREFS)[number],
  };
  const { value: v, update } = useDraft("fast", base, overrides);
  const selected = destinations.find((d) => d.slug === v.destination);

  useEffect(() => {
    if (state.errors) document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [state]);

  return (
    <form action={formAction} className="form wizard-panel" noValidate>
      <FormMessage state={state} />
      <div className="form-row">
        <Field label={t("destination")} name="destination" error={err("destination")}>
          {(p) => (
            <select {...p} className="select" value={v.destination} onChange={(e) => update("destination", e.target.value)} required>
              <option value="">{t("chooseDestination")}</option>
              {destinations.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.city}, {d.country}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("departureCity")} name="departureCity" error={err("departureCity")} hint={t("optional")}>
          {(p) => <input {...p} className="input" value={v.departureCity} onChange={(e) => update("departureCity", e.target.value)} autoComplete="address-level2" />}
        </Field>
      </div>
      {selected && selected.placeCount === 0 ? <Notice tone="warning">{t("limitedData", { city: selected.city })}</Notice> : null}
      <div className="form-row">
        <Field label={t("arrivalDate")} name="startDate" error={err("startDate")}>
          {(p) => <DateInput {...p} value={v.startDate} min={todayPlus(0)} onChange={(x) => update("startDate", x)} required />}
        </Field>
        <Field label={t("departureDate")} name="endDate" error={err("endDate")}>
          {(p) => <DateInput {...p} value={v.endDate} min={v.startDate} onChange={(x) => update("endDate", x)} required />}
        </Field>
        <Counter label={t("adults")} name="adults" value={v.adults} min={1} max={20} onChange={(n) => update("adults", n)} />
        <Counter label={t("children")} name="children" value={v.children} min={0} max={20} onChange={(n) => update("children", n)} />
      </div>
      <div className="form-row">
        <Field label={t("budgetTotal")} name="budgetTotal" error={err("budgetTotal")} hint={t("optional")}>
          {(p) => <input {...p} className="input" type="number" inputMode="decimal" min={0} value={v.budgetTotal} onChange={(e) => update("budgetTotal", e.target.value)} />}
        </Field>
        <Field label={t("currency")} name="currency" error={err("currency")}>
          {(p) => (
            <select {...p} className="select" value={v.currency} onChange={(e) => update("currency", e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <ChoiceCards legend={t("budgetCategory")} name="budgetCategory" options={BUDGET_CATEGORIES} value={v.budgetCategory} onChange={(x) => update("budgetCategory", x)} labelFor={(o) => t(`budgetCategories.${o}`)} />
      <ChoiceCards legend={t("pace")} name="pace" options={TRAVEL_STYLES} value={v.pace} onChange={(x) => update("pace", x)} labelFor={(o) => t(`paces.${o}`)} hintFor={(o) => t(`paceHints.${o}`)} />
      <ChipGroup legend={t("interests")} name="interests" options={INTERESTS} value={v.interests} onChange={(x) => update("interests", x)} labelFor={(o) => t(`interestOptions.${o}`)} />
      <ChoiceCards legend={t("transport")} name="transport" options={TRANSPORT_PREFS} value={v.transport} onChange={(x) => update("transport", x)} labelFor={(o) => t(`transportOptions.${o}`)} />
      <ChipGroup legend={t("food")} name="foodPrefs" options={FOOD_PREFS} value={v.foodPrefs} onChange={(x) => update("foodPrefs", x)} labelFor={(o) => t(`foodOptions.${o}`)} />
      <p className="small muted">{aiEnabled ? t("aiNote") : t("rulesNote")}</p>
      <div className="wizard-footer">
        <span className="small muted">{t("editLater")}</span>
        <SubmitButton className="btn btn--primary btn--lg" pendingLabel={t("generating")}>
          {t("generate")}
        </SubmitButton>
      </div>
    </form>
  );
}
