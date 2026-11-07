import { LOCALE_META, isLocale } from "@/config/locales";

export function intlLocale(locale: string): string {
  return isLocale(locale) ? LOCALE_META[locale].intl : "en-GB";
}

/** Country names come from the platform's Intl data, so they are correct in every language. */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([intlLocale(locale)], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function formatMoney(amount: number, currency: string, locale: string, opts: Intl.NumberFormatOptions = {}): string {
  try {
    return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency, maximumFractionDigits: amount % 1 === 0 ? 0 : 2, ...opts }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatCents(cents: number, currency: string, locale: string): string {
  return formatMoney(cents / 100, currency, locale, { minimumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}

/** Formats an ISO date (YYYY-MM-DD) without timezone drift. */
export function formatDate(iso: string | null | undefined, locale: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** A timestamp (Date or ISO string) as a date, or date + time, in the user's language — English uses day/month/year. */
export function formatDateTime(value: Date | string, locale: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  const d = typeof value === "string" ? new Date(value) : value;
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), opts).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function formatTime(hhmm: string | null | undefined, locale: string, pref: "auto" | "12h" | "24h" = "auto"): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone: "UTC" };
  if (pref !== "auto") opts.hour12 = pref === "12h";
  return new Intl.DateTimeFormat(intlLocale(locale), opts).format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

export function formatDistance(meters: number, locale: string, units: "metric" | "imperial" = "metric"): string {
  const nf = (n: number, unit: string, digits = 1) =>
    new Intl.NumberFormat(intlLocale(locale), { style: "unit", unit, maximumFractionDigits: digits }).format(n);
  if (units === "imperial") {
    const miles = meters / 1609.344;
    return miles < 0.2 ? nf(Math.round(meters * 3.28084), "foot", 0) : nf(miles, "mile");
  }
  return meters < 1000 ? nf(Math.round(meters / 10) * 10, "meter", 0) : nf(meters / 1000, "kilometer");
}

export function formatDuration(minutes: number, locale: string): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  const fmt = (n: number, unit: "hour" | "minute") =>
    new Intl.NumberFormat(intlLocale(locale), { style: "unit", unit, unitDisplay: "short" }).format(n);
  if (h && m) return `${fmt(h, "hour")} ${fmt(m, "minute")}`;
  return h ? fmt(h, "hour") : fmt(m, "minute");
}

export function monthName(month: number, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2000, month - 1, 1)));
}

/** Inclusive number of calendar days from start to end (2027-01-01 → 2027-01-03 = 3). */
export function daysBetween(start: string, end: string): number {
  const a = Date.parse(start.slice(0, 10) + "T00:00:00Z");
  const b = Date.parse(end.slice(0, 10) + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000) + 1;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(Date.parse(iso.slice(0, 10) + "T00:00:00Z") + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}
