
/** Base URL comes from env so no domain is hard-coded. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export const FREE_TRIPS_INCLUDED = 1;
export const MAX_TRIP_DAYS = 21;

export const PUBLIC_PATHS = [
  "",
  "/explore",
  "/plan",
  "/community",
  "/about",
  "/reviews",
  "/faq",
  "/contact",
  "/pricing",
  "/legal/privacy",
  "/legal/terms",
  "/legal/cookies",
  "/legal/subscriptions",
] as const;
