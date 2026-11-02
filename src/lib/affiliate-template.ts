/**
 * Affiliate link templates (pure, unit-tested).
 *
 * An admin pastes the tracking link a partner programme gave them, with optional placeholders
 * that TRIPLAN fills in: {city} {country} {checkin} {checkout} {adults} {lat} {lng} {locale}.
 * Values are URL-encoded and can never change the link's host.
 */
export const PLACEHOLDERS = ["city", "country", "checkin", "checkout", "adults", "lat", "lng", "locale"] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];
export type TemplateParams = Partial<Record<Placeholder, string | number | null | undefined>>;

export type TemplateProblem = "invalid" | "notHttps" | "placeholderInHost" | "unknownPlaceholder" | "credentials";

export function checkTemplate(template: string): TemplateProblem | null {
  const t = template.trim();
  if (!/^https:\/\//i.test(t)) return "notHttps";
  const hostPart = t.slice(8).split(/[/?#]/)[0];
  if (/[{}]/.test(hostPart)) return "placeholderInHost";
  if (hostPart.includes("@")) return "credentials";
  for (const m of t.matchAll(/\{(\w+)\}/g)) if (!(PLACEHOLDERS as readonly string[]).includes(m[1])) return "unknownPlaceholder";
  try {
    const u = new URL(t.replace(/\{\w+\}/g, "x"));
    if (u.protocol !== "https:" || !u.hostname.includes(".")) return "invalid";
  } catch {
    return "invalid";
  }
  return null;
}

/** Fills the placeholders. Missing values become empty; the result always keeps the template's host. */
export function fillTemplate(template: string, params: TemplateParams): string | null {
  if (checkTemplate(template)) return null;
  const out = template.trim().replace(/\{(\w+)\}/g, (_, k: Placeholder) => {
    const v = params[k];
    return v == null ? "" : encodeURIComponent(String(v).slice(0, 120));
  });
  const host = new URL(template.trim().replace(/\{\w+\}/g, "x")).host;
  try {
    return new URL(out).host === host ? out : null;
  } catch {
    return null;
  }
}

/** Query parameters accepted by /api/go/<partner> (everything else is ignored). */
export function paramsFromQuery(q: URLSearchParams): TemplateParams {
  const pick = (k: string, re: RegExp) => {
    const v = q.get(k);
    return v && re.test(v) ? v : undefined;
  };
  return {
    city: pick("city", /^[\p{L}\p{M}\p{N} .,'’()-]{1,80}$/u),
    country: pick("country", /^[A-Z]{2}$/),
    checkin: pick("checkin", /^\d{4}-\d{2}-\d{2}$/),
    checkout: pick("checkout", /^\d{4}-\d{2}-\d{2}$/),
    adults: pick("adults", /^([1-9]|1\d|20)$/),
    lat: pick("lat", /^-?\d{1,2}(\.\d{1,6})?$/),
    lng: pick("lng", /^-?\d{1,3}(\.\d{1,6})?$/),
    locale: pick("locale", /^(en|ar|fr|es|it|zh|ru|pt)$/),
  };
}
