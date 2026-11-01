"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

export function ChipGroup<T extends string>({ legend, name, options, value, onChange, labelFor, single = false }: { legend: string; name: string; options: readonly T[]; value: T[]; onChange: (v: T[]) => void; labelFor: (o: T) => string; single?: boolean }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="chips">
        {options.map((o) => (
          <label key={o} className="chip">
            <input
              type={single ? "radio" : "checkbox"}
              name={name}
              value={o}
              checked={value.includes(o)}
              onChange={(e) => onChange(single ? [o] : e.target.checked ? [...value, o] : value.filter((x) => x !== o))}
            />
            <span>{labelFor(o)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ChoiceCards<T extends string>({ legend, name, options, value, onChange, labelFor, hintFor }: { legend: string; name: string; options: readonly T[]; value: T; onChange: (v: T) => void; labelFor: (o: T) => string; hintFor?: (o: T) => string }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="choice-cards">
        {options.map((o) => (
          <label key={o} className="choice-card">
            <input type="radio" name={name} value={o} checked={value === o} onChange={() => onChange(o)} />
            <span>
              <strong>{labelFor(o)}</strong>
              {hintFor ? <small>{hintFor(o)}</small> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Counter({ label, value, min, max, onChange, name }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; name: string }) {
  const id = useId();
  const t = useTranslations("planner");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="counter">
        <button type="button" aria-label={t("decrease", { label })} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
          −
        </button>
        <input id={id} name={name} type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))} />
        <button type="button" aria-label={t("increase", { label })} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
          +
        </button>
      </div>
    </div>
  );
}
