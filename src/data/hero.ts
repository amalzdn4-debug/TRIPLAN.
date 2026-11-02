/**
 * Default homepage hero rotation. Used to seed the `hero_slides` table and as a
 * graceful fallback if the database is unavailable. Admins manage the live list
 * at /admin/hero.
 *
 * All photographs are published on Unsplash under the Unsplash License
 * (https://unsplash.com/license) — free for commercial use, no permission needed.
 * Photographer credit is shown discreetly in the hero caption.
 */
export interface HeroSlideData {
  id: string;
  imageUrl: string;
  alt: string;
  city: string;
  /** Localized city names by language, when known. */
  cityNames?: Record<string, string>;
  countryCode: string;
  destinationSlug?: string | null;
  creditName?: string | null;
  creditUrl?: string | null;
  /** Wikimedia photos carry their licence, shown in the credit line. */
  license?: string | null;
  licenseUrl?: string | null;
  source?: "unsplash" | "wikimedia" | "upload" | null;
}

const u = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=2400&q=75`;

export const DEFAULT_HERO_SLIDES: HeroSlideData[] = [
  { id: "kyoto", imageUrl: u("photo-1580639463127-3434c2af2707"), alt: "Yasaka Pagoda silhouetted at sunset above the rooftops of Higashiyama, Kyoto", city: "Kyoto", countryCode: "JP", destinationSlug: "kyoto", creditName: "Cosmin Serban", creditUrl: "https://unsplash.com/photos/black-pagoda-temple-during-daytime-jZyQV3I2rT4" },
  { id: "paris", imageUrl: u("photo-1502602898657-3e91760cbb34"), alt: "The Eiffel Tower and the Seine under a dramatic sky in Paris", city: "Paris", countryCode: "FR", destinationSlug: "paris", creditName: "Chris Karidis", creditUrl: "https://unsplash.com/photos/eiffel-tower-paris-france-nnzkZNYWHaU" },
  { id: "cape-town", imageUrl: u("photo-1575540538034-c69be309c367"), alt: "Table Mountain rising behind the V&A Waterfront harbour in Cape Town", city: "Cape Town", countryCode: "ZA", destinationSlug: "cape-town", creditName: "Matthias Mullie", creditUrl: "https://unsplash.com/photos/photography-of-buildings-beside-body-of-water-during-daytime-9MUGYaENbHM" },
  { id: "new-york", imageUrl: u("photo-1757800341477-7a0f940d9d4d"), alt: "Lower Manhattan skyline seen from the water at sunset, New York", city: "New York", countryCode: "US", destinationSlug: "new-york", creditName: "Sebastian Schuster", creditUrl: "https://unsplash.com/photos/new-york-city-skyline-over-the-water-at-sunset-VOTj2tWy400" },
  { id: "marrakech", imageUrl: u("photo-1569440703456-29b9c31765ca"), alt: "Colourful lanterns and crafts in a souk in the Marrakech medina", city: "Marrakech", countryCode: "MA", destinationSlug: "marrakech", creditName: "Jean Carlo Emer", creditUrl: "https://unsplash.com/photos/UIwwV5GlyqY" },
  { id: "rio", imageUrl: u("photo-1619546952812-520e98064a52"), alt: "Sugarloaf cable car above Copacabana and Rio de Janeiro at golden hour", city: "Rio de Janeiro", countryCode: "BR", destinationSlug: "rio-de-janeiro", creditName: "F Cary Snyder", creditUrl: "https://unsplash.com/photos/cable-cars-over-the-green-grass-field-76L0Hup2Zyo" },
  { id: "amalfi", imageUrl: u("photo-1568282167464-cb0d811b05c2"), alt: "Pastel houses of Positano cascading to the sea on the Amalfi Coast", city: "Amalfi Coast", countryCode: "IT", destinationSlug: "amalfi-coast", creditName: "Letizia Agosta", creditUrl: "https://unsplash.com/photos/3TzHmifXX5k" },
  { id: "dubai", imageUrl: u("photo-1768069794857-9306ac167c6e"), alt: "Dubai Marina skyline glowing at dusk", city: "Dubai", countryCode: "AE", destinationSlug: "dubai", creditName: "Nejc Soklič", creditUrl: "https://unsplash.com/photos/city-skyline-illuminated-at-dusk-with-colorful-sky-6gAHA4cQ7r8" },
  { id: "bali", imageUrl: u("photo-1555400038-63f5ba517a47"), alt: "Morning light over the Tegallalang rice terraces near Ubud, Bali", city: "Bali", countryCode: "ID", destinationSlug: "bali", creditName: "Niklas Weiss", creditUrl: "https://unsplash.com/photos/green-rice-field--2WlTWZLnRc" },
  { id: "istanbul", imageUrl: u("photo-1564407727371-3eece6c58961"), alt: "Ortaköy Mosque and the Bosphorus Bridge in early morning light, Istanbul", city: "Istanbul", countryCode: "TR", destinationSlug: "istanbul", creditName: "Meriç Dağlı", creditUrl: "https://unsplash.com/photos/xmZ7nuqK7kg" },
  { id: "sydney", imageUrl: u("photo-1725019832456-0dc59ed1c8cf"), alt: "Sydney Opera House lit up during blue hour", city: "Sydney", countryCode: "AU", destinationSlug: "sydney", creditName: "Terry Ling", creditUrl: "https://unsplash.com/photos/the-sydney-opera-house-lit-up-at-night-Bud9bQCqOps" },
  { id: "lisbon", imageUrl: u("photo-1501415201023-2f45fbcefac0"), alt: "Historic yellow Tram 28 on a Lisbon street", city: "Lisbon", countryCode: "PT", destinationSlug: "lisbon", creditName: "Etienne Gobeli", creditUrl: "https://unsplash.com/photos/UIIwSB8q3mo" },
  { id: "santorini", imageUrl: u("photo-1530841377377-3ff06c0ca713"), alt: "Whitewashed houses of Oia on the Santorini caldera at sunset", city: "Santorini", countryCode: "GR", destinationSlug: "santorini", creditName: "Jonathan Gallegos", creditUrl: "https://unsplash.com/photos/santorini-greece-_vA2q0-NroU" },
];
