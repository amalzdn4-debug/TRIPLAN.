"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";

export interface PickedPlace {
  label: string;
  name: string;
  lat: number;
  lng: number;
  kind: "address" | "airport" | "station" | "place";
}

/**
 * Search-as-you-type for addresses, airports or stations (OpenStreetMap data via our /api/geocode).
 * Accessible combobox: ↑/↓ to move, Enter to choose, Esc to close.
 */
export function AddressSearch({
  id,
  label,
  kind = "address",
  near,
  value,
  onChange,
  onPick,
  hint,
  error,
  placeholder,
}: {
  id: string;
  label: string;
  kind?: "address" | "airport" | "station";
  near?: { lat: number; lng: number } | null;
  value: string;
  onChange: (text: string) => void;
  onPick: (p: PickedPlace) => void;
  hint?: string;
  error?: string | null;
  placeholder?: string;
}) {
  const t = useTranslations("geo");
  const locale = useLocale();
  const listId = useId();
  const [results, setResults] = useState<PickedPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const typed = useRef(false);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!typed.current) return;
    const q = value.trim();
    if (q.length < 3) {
      setResults([]);
      setState("idle");
      return;
    }
    const timer = setTimeout(async () => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      setState("loading");
      try {
        const params = new URLSearchParams({ q, kind, lang: locale });
        if (near) {
          params.set("lat", String(near.lat));
          params.set("lng", String(near.lng));
        }
        const res = await fetch(`/api/geocode?${params}`, { signal: c.signal });
        const data = (await res.json()) as { results?: PickedPlace[] };
        if (!res.ok) throw new Error(String(res.status));
        setResults(data.results ?? []);
        setState(data.results?.length ? "idle" : "empty");
        setOpen(true);
        setActive(-1);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setResults([]);
          setState("error");
          setOpen(true);
        }
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [value, kind, locale, near?.lat, near?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (p: PickedPlace) => {
    typed.current = false;
    onPick(p);
    setOpen(false);
    setResults([]);
    setState("idle");
  };

  return (
    <div className="field addr-search">
      <label htmlFor={id}>{label}</label>
      <div className="addr-search__box">
        <Icon name="search" className="addr-search__icon" aria-hidden />
        <input
          id={id}
          className="input"
          role="combobox"
          aria-expanded={open && (results.length > 0 || state !== "idle")}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          maxLength={240}
          onChange={(e) => {
            typed.current = true;
            onChange(e.target.value);
          }}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && results.length) {
              e.preventDefault();
              setOpen(true);
              setActive((a) => (a + 1) % results.length);
            } else if (e.key === "ArrowUp" && results.length) {
              e.preventDefault();
              setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
            } else if (e.key === "Enter" && open && active >= 0 && results[active]) {
              e.preventDefault();
              choose(results[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {state === "loading" ? <span className="spinner addr-search__spin" aria-hidden /> : null}
      </div>
      {hint ? <p id={`${id}-hint`} className="field-hint">{hint}</p> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {open ? (
        <div className="addr-search__pop">
          <ul id={listId} role="listbox" aria-label={label} className="addr-search__list">
            {results.map((r, i) => (
              <li
                key={`${r.lat},${r.lng},${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? "is-active" : undefined}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(r);
                }}
              >
                <Icon name={r.kind === "airport" ? "plane" : r.kind === "station" ? "train" : "pin"} />
                <bdi>{r.label}</bdi>
              </li>
            ))}
          </ul>
          {state === "empty" ? <p className="small muted addr-search__note">{t("noResults")}</p> : null}
          {state === "error" ? <p className="small muted addr-search__note">{t("unavailable")}</p> : null}
          <p className="addr-search__attr">{t("attribution")}</p>
        </div>
      ) : null}
    </div>
  );
}
