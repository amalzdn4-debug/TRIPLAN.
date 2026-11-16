export interface PlannerDestination {
  slug: string;
  city: string;
  country: string;
  placeCount: number;
}

export const CURRENCIES = ["EUR", "USD", "GBP", "AED", "SAR", "QAR", "MAD", "EGP", "TRY", "CHF", "JPY", "CNY", "KRW", "INR", "SGD", "AUD", "CAD", "BRL", "MXN", "ZAR", "RUB"] as const;

export function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** `days` after the given ISO date (UTC-safe). */
export function todayPlusFrom(iso: string, days: number) {
  const d = new Date(Date.parse(iso.slice(0, 10) + "T00:00:00Z") + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}
