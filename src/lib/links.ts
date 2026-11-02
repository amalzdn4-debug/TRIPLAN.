/**
 * Outbound search links to booking & information sites. These are plain links — no affiliate
 * ids, no prices, no availability. Affiliate links come only from partners an admin has marked
 * as approved (see src/lib/affiliates.ts); those are flagged `partner: true` and labelled.
 */
export interface OutboundLink {
  provider: string;
  url: string;
  category: "accommodation" | "flights" | "activities" | "luggage" | "transport" | "restaurants";
  /** An approved affiliate partner (shown with a "Partner" label and the disclosure). */
  partner?: boolean;
}

const q = encodeURIComponent;

export function accommodationLinks(city: string, checkIn?: string | null, checkOut?: string | null, adults = 2): OutboundLink[] {
  const booking = new URL("https://www.booking.com/searchresults.html");
  booking.searchParams.set("ss", city);
  if (checkIn) booking.searchParams.set("checkin", checkIn);
  if (checkOut) booking.searchParams.set("checkout", checkOut);
  booking.searchParams.set("group_adults", String(Math.max(1, adults)));

  const airbnb = new URL(`https://www.airbnb.com/s/${q(city)}/homes`);
  if (checkIn) airbnb.searchParams.set("checkin", checkIn);
  if (checkOut) airbnb.searchParams.set("checkout", checkOut);
  airbnb.searchParams.set("adults", String(Math.max(1, adults)));

  const expedia = new URL("https://www.expedia.com/Hotel-Search");
  expedia.searchParams.set("destination", city);
  if (checkIn) expedia.searchParams.set("startDate", checkIn);
  if (checkOut) expedia.searchParams.set("endDate", checkOut);

  return [
    { provider: "Booking.com", url: booking.toString(), category: "accommodation" },
    { provider: "Airbnb", url: airbnb.toString(), category: "accommodation" },
    { provider: "Expedia", url: expedia.toString(), category: "accommodation" },
    { provider: "Hotels.com", url: `https://www.hotels.com/Hotel-Search?destination=${q(city)}`, category: "accommodation" },
    { provider: "Hostelworld", url: "https://www.hostelworld.com/", category: "accommodation" },
  ];
}

export function flightLinks(to: string, from?: string | null, date?: string | null, returnDate?: string | null): OutboundLink[] {
  const parts = [`Flights to ${to}`];
  if (from) parts.push(`from ${from}`);
  if (date) parts.push(`on ${date}`);
  if (returnDate) parts.push(`returning ${returnDate}`);
  return [
    { provider: "Google Flights", url: `https://www.google.com/travel/flights?q=${q(parts.join(" "))}`, category: "flights" },
    { provider: "Skyscanner", url: "https://www.skyscanner.net/", category: "flights" },
    { provider: "Kiwi.com", url: "https://www.kiwi.com/", category: "flights" },
  ];
}

export function activityLinks(city: string): OutboundLink[] {
  const gyg = new URL("https://www.getyourguide.com/s/");
  gyg.searchParams.set("q", city);
  const viator = new URL("https://www.viator.com/searchResults/all");
  viator.searchParams.set("text", city);
  return [
    { provider: "GetYourGuide", url: gyg.toString(), category: "activities" },
    { provider: "Viator", url: viator.toString(), category: "activities" },
    { provider: "Tiqets", url: "https://www.tiqets.com/", category: "activities" },
  ];
}

export function luggageLinks(city: string): OutboundLink[] {
  return [
    { provider: "Bounce", url: "https://bounce.com/", category: "luggage" },
    { provider: "Radical Storage", url: "https://radicalstorage.com/", category: "luggage" },
    { provider: "LuggageHero", url: "https://luggagehero.com/", category: "luggage" },
    { provider: "Google Maps", url: `https://www.google.com/maps/search/${q(`luggage storage ${city}`)}`, category: "luggage" },
  ];
}

export function transportLinks(city: string): OutboundLink[] {
  return [
    { provider: "Google Maps (transit)", url: `https://www.google.com/maps/search/${q(`public transport ${city}`)}`, category: "transport" },
    { provider: "Rome2Rio", url: `https://www.rome2rio.com/s/${q(city)}`, category: "transport" },
    { provider: "Rentalcars.com", url: "https://www.rentalcars.com/", category: "transport" },
  ];
}

const FOOD_QUERY: Record<string, string> = {
  halal: "halal restaurant",
  seafood: "seafood restaurant",
  vegetarian: "vegetarian restaurant",
  vegan: "vegan restaurant",
  fast_food: "fast food",
  local: "local cuisine restaurant",
  fine_dining: "fine dining",
  budget: "cheap eats",
  international: "international restaurant",
};
const MEAL_QUERY: Record<string, string> = { breakfast: "breakfast", lunch: "lunch", snack: "cafe", dinner: "dinner", drinks: "bar" };

/** Live map search for food matching the traveller's preferences near a point. */
export function restaurantSearchUrl(opts: { mealType?: string | null; foodPrefs?: string[]; near?: { lat: number; lng: number } | null; area?: string | null; city?: string | null }): string {
  const pref = (opts.foodPrefs ?? []).map((f) => FOOD_QUERY[f]).filter(Boolean)[0];
  const meal = opts.mealType ? MEAL_QUERY[opts.mealType] : "restaurant";
  const what = opts.mealType === "drinks" || opts.mealType === "snack" ? meal : pref ? `${pref} ${meal === "restaurant" ? "" : meal}`.trim() : meal;
  const where = [opts.area, opts.city].filter(Boolean).join(", ");
  const query = where ? `${what} near ${where}` : what;
  const base = "https://www.google.com/maps/search/";
  return opts.near ? `${base}${q(query)}/@${opts.near.lat.toFixed(5)},${opts.near.lng.toFixed(5)},16z` : `${base}${q(query)}`;
}
