import type { CandidatePlace, TripPreferences } from "@/lib/itinerary/types";

/** Synthetic places (not real venues) laid out in three clusters ~3 km apart. */
export function samplePlaces(): CandidatePlace[] {
  const clusters = [
    { hood: "Old Town", lat: 41.9, lng: 12.48 },
    { hood: "Riverside", lat: 41.925, lng: 12.5 },
    { hood: "Hill District", lat: 41.88, lng: 12.51 },
  ];
  const tagsCycle = [["museums", "history"], ["architecture"], ["nature"], ["food", "markets"], ["culture"]];
  const out: CandidatePlace[] = [];
  clusters.forEach((c, ci) => {
    for (let i = 0; i < 5; i++) {
      out.push({
        id: `p${ci}-${i}`,
        name: `${c.hood} place ${i + 1}`,
        kind: "attraction",
        tags: tagsCycle[i],
        durationMin: 90,
        neighborhood: c.hood,
        lat: c.lat + i * 0.002,
        lng: c.lng + i * 0.002,
      });
    }
  });
  return out;
}

export function samplePrefs(over: Partial<TripPreferences> = {}): TripPreferences {
  return {
    destinationName: "Testville",
    startDate: "2027-05-10",
    endDate: "2027-05-12",
    adults: 2,
    children: 0,
    currency: "EUR",
    budgetCategory: "mid",
    pace: "balanced",
    interests: ["museums", "history"],
    foodPrefs: [],
    transport: "public",
    morning: "early",
    dayLength: "full",
    activityBalance: "balanced",
    walking: "medium",
    accommodation: { status: "recommend" },
    ...over,
  };
}
