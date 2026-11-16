"use client";

import { forwardRef, useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { intlLocale } from "@/lib/format";
import { maskTime, normalizeTime } from "@/lib/time";

export { maskTime, normalizeTime };

/**
 * 24-hour time field ("HH:MM") that works well on phones:
 *  • type digits only — the colon is added for you (the numeric keypad has no ":" key);
 *  • or tap the clock to use the phone's own hour/minute picker (the native time input, which
 *    always returns 24-hour HH:MM whatever the phone shows);
 *  • invalid times get a clear message when you leave the field.
 */
export const TimeInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: string; onChange: (v: string) => void }>(function TimeInput(
  { value, onChange, className, id, ...rest },
  ref,
) {
  const t = useTranslations("common");
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(value);
    setInvalid(false);
  }, [value]);
  const errId = id ? `${id}-time-err` : undefined;
  const describedBy = [rest["aria-describedby"], invalid ? errId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="time-input">
      <div className="time-input__row">
        <input
          {...rest}
          id={id}
          ref={ref}
          className={`${className ?? "input"} ltr time-input__text`}
          inputMode="numeric"
          autoComplete="off"
          placeholder={rest.placeholder ?? "hh:mm"}
          maxLength={5}
          aria-invalid={invalid || rest["aria-invalid"] ? true : undefined}
          aria-describedby={describedBy}
          value={text}
          onChange={(e) => {
            const masked = maskTime(e.target.value);
            setText(masked);
            setInvalid(false);
            if (masked === "") onChange("");
            else if (/^\d{2}:\d{2}$/.test(masked) && normalizeTime(masked)) onChange(normalizeTime(masked)!);
          }}
          onBlur={(e) => {
            const n = normalizeTime(text);
            if (n === null) setInvalid(true);
            else {
              setText(n);
              onChange(n);
            }
            rest.onBlur?.(e);
          }}
        />
        <span className="time-input__pick" title={t("pickTime")}>
          <Icon name="clock" aria-hidden />
          <input
            type="time"
            className="time-input__native"
            tabIndex={-1}
            aria-label={t("pickTime")}
            value={/^\d{2}:\d{2}$/.test(value) ? value : ""}
            onChange={(e) => {
              if (!e.target.value) return;
              setText(e.target.value.slice(0, 5));
              setInvalid(false);
              onChange(e.target.value.slice(0, 5));
            }}
          />
        </span>
      </div>
      {invalid ? <p id={errId} className="field-error" role="alert">{t("timeInvalid")}</p> : null}
    </div>
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
