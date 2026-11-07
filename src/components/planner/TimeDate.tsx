"use client";

import { forwardRef, useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { useLocale } from "next-intl";
import { intlLocale } from "@/lib/format";
import { normalizeTime } from "@/lib/time";

export { normalizeTime };

/**
 * 24-hour time field ("HH:MM"). A plain text field on purpose: the browser's own time picker shows
 * AM/PM on many English systems, while European travellers expect 24-hour times.
 */
export const TimeInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: string; onChange: (v: string) => void }>(function TimeInput(
  { value, onChange, className, ...rest },
  ref,
) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      {...rest}
      ref={ref}
      className={`${className ?? "input"} ltr`}
      inputMode="numeric"
      placeholder="hh:mm"
      maxLength={5}
      pattern="([01]\d|2[0-3]):[0-5]\d"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = normalizeTime(e.target.value);
        if (n !== null && (n === "" || /^\d{2}:\d{2}$/.test(e.target.value.trim()))) onChange(n);
      }}
      onBlur={(e) => {
        const n = normalizeTime(text);
        if (n !== null) {
          setText(n);
          onChange(n);
        }
        rest.onBlur?.(e);
      }}
    />
  );
});

/** Numeric date in the user's language: 22/12/2026 in English and Italian, 22.12.2026 in Russian… */
export function formatNumericDate(iso: string, locale: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Date field that always reads day/month/year (in the user's language), whatever the browser's
 * own locale: the native date input sits on top, transparent, so the calendar still opens.
 */
export const DateInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & { value: string; onChange: (v: string) => void }>(function DateInput(
  { value, onChange, className, id, ...rest },
  ref,
) {
  const locale = useLocale();
  const inner = useRef<HTMLInputElement | null>(null);
  return (
    <div className={`date-input ${className ?? ""}`}>
      <span className="input date-input__face ltr" aria-hidden>
        {value ? formatNumericDate(value, locale) : <span className="muted">{formatNumericDate("2026-12-31", locale).replace(/\d/g, "–")}</span>}
      </span>
      <input
        {...rest}
        id={id}
        ref={(n) => {
          inner.current = n;
          if (typeof ref === "function") ref(n);
          else if (ref) ref.current = n;
        }}
        type="date"
        className="date-input__native"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={() => {
          try {
            inner.current?.showPicker?.();
          } catch {
            /* older browsers: the native field still works */
          }
        }}
      />
    </div>
  );
});
