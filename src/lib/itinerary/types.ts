import type { LatLng, TransportPreference, TravelMode } from "@/lib/geo";

export const INTERESTS = [
  "culture", "architecture", "history", "museums", "nature", "beaches", "shopping", "food",
  "nightlife", "photography", "family", "adventure", "local", "hidden_gems", "relaxation",
] as const;
export type Interest = (typeof INTERESTS)[number];

export const FOOD_PREFS = ["halal", "seafood", "vegetarian", "vegan", "fast_food", "local", "fine_dining", "budget", "international"] as const;
export type FoodPref = (typeof FOOD_PREFS)[number];

export const TRAVEL_STYLES = ["relaxed", "balanced", "packed"] as const;
export const BUDGET_CATEGORIES = ["budget", "mid", "premium", "luxury"] as const;
export const TRANSPORT_PREFS = ["walking", "public", "driving", "cycling", "mixed"] as const;

export interface TripPreferences {
  destinationSlug?: string | null;
  destinationName: string;
  departureCity?: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  departureTime?: string | null;
  returnTime?: string | null;
  adults: number;
  children: number;
  companions?: "solo" | "couple" | "family" | "friends" | "business" | null;
  budgetTotal?: number | null;
  budgetPerPerson?: number | null;
  currency: string;
  budgetCategory: (typeof BUDGET_CATEGORIES)[number];
  budgetSplit?: { accommodation?: number | null; food?: number | null; activities?: number | null; transport?: number | null };
  pace: (typeof TRAVEL_STYLES)[number];
  interests: Interest[];
  foodPrefs: FoodPref[];
  dietaryNotes?: string | null;
  transport: TransportPreference;
  morning: "early" | "relaxed";
  dayLength: "full" | "flexible";
  activityBalance: "more_activities" | "balanced" | "more_free_time";
  walking: "low" | "medium" | "high";
  accommodation: {
    status: "booked" | "recommend" | "compare";
    name?: string | null;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    types?: string[];
  };
  /**
   * Multi-city plan accepted by the traveller (first entry = main destination). Absent or a single
   * entry = the whole trip is spent at the main destination.
   */
  segments?: import("./split").TripSegment[];
  /** The traveller's answer to the stay-length suggestion, so it isn't shown again. */
  splitDecision?: "accepted" | "declined" | null;
}

export interface CandidatePlace extends LatLng {
  id: string;
  name: string;
  kind: string;
  tags: string[];
  durationMin: number | null;
  neighborhood: string | null;
  /** Number of Wikipedia editions covering the place (imported from Wikidata) — a popularity signal. */
  popularity?: number;
  /** Which destination this place belongs to (multi-city trips). */
  destinationSlug?: string;
}

/** Intercity journey shown on a travel stop. Typical times only — never live schedules or prices. */
export interface IntercityDetails {
  from: string;
  to: string;
  mode: "train" | "bus" | "ferry" | "flight" | "car";
  minutes: number;
  direct: boolean;
  source: "curated" | "estimate";
  note?: string | null;
  distanceKm: number;
  /** "out" / "back" for day trips, "onward" for moving to the next stay. */
  direction: "onward" | "out" | "back";
}

export interface PlannedStop {
  id?: string;
  kind: "attraction" | "meal" | "activity" | "break" | "accommodation" | "transport" | "custom";
  mealType?: "breakfast" | "lunch" | "snack" | "dinner" | "drinks" | null;
  title: string;
  description?: string | null;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  startTime?: string | null;
  durationMin: number;
  costMin?: number | null;
  costMax?: number | null;
  costCurrency?: string | null;
  costBasis?: "per_person" | "total" | null;
  costStatus?: "estimated" | "confirmed" | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  locked: boolean;
  travelMode?: TravelMode | null;
  travelMinutes?: number | null;
  travelMeters?: number | null;
  travelSource?: "provider" | "estimate" | null;
  /** Extra structured data, e.g. { intercity: IntercityDetails }. */
  details?: { intercity?: IntercityDetails } | null;
}

export interface PlannedDay {
  dayIndex: number;
  date: string | null;
  title: string;
  startTime: string;
  stops: PlannedStop[];
  /** Which destination the day is spent in (multi-city trips). */
  destinationId?: string | null;
  kind?: "normal" | "travel" | "day_trip";
}
