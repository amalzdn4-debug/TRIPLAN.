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
