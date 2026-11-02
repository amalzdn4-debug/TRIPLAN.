/**
 * Seed data for the global destination database.
 *
 * IMPORTANT — data status:
 *  • All editorial text below is SAMPLE content written for the initial launch. It is stored with
 *    content_status = "sample" and labelled as such in the UI until an editor verifies it in /admin.
 *  • Places are well-known public landmarks with approximate coordinates (verification = "sample").
 *    No restaurants, prices, opening hours, ratings or reviews are seeded — the app never invents them.
 *  • New destinations are added through /admin or by extending this file and re-running `npm run db:seed`
 *    (the seed is idempotent and keyed by slug) — no application code changes are needed.
 */
import { DEFAULT_HERO_SLIDES } from "./hero";
import { COUNTRY_INFO } from "./world/define";
import { EUROPE } from "./world/europe";
import { MENA_AFRICA } from "./world/mena-africa";
import { ASIA } from "./world/asia";
import { AMERICAS_OCEANIA } from "./world/americas-oceania";

export type Continent = "europe" | "mena" | "asia" | "north_america" | "south_america" | "africa" | "oceania";
export type TravelStyle = "city_break" | "culture" | "beach" | "nature" | "food" | "romantic" | "family" | "adventure" | "luxury" | "budget";
export type Experience = "museums" | "architecture" | "history" | "nightlife" | "shopping" | "beaches" | "hiking" | "food" | "markets" | "photography" | "relaxation" | "local";
export type Climate = "temperate" | "mediterranean" | "tropical" | "desert" | "continental" | "subtropical" | "oceanic" | "alpine" | "subarctic";

export interface SeedPlace {
  name: string;
  lat: number;
  lng: number;
  kind: "attraction" | "activity";
  tags: string[];
  durationMin: number;
  neighborhood?: string;
}

export interface SeedDestination {
  slug: string;
  city: string;
  country: string; // ISO 3166-1 alpha-2
  continent: Continent;
  lat: number;
  lng: number;
  tz: string;
  summary: string;
  bestTime: string;
  bestMonths: number[];
  days: [number, number];
  budget: "budget" | "mid" | "premium";
  climate: Climate;
  styles: TravelStyle[];
  experiences: Experience[];
  popularity: number;
  featured?: boolean;
  neighborhoods?: string[];
  places?: SeedPlace[];
  /** city | coastal | island | nature — used for stay planning and slideshow variety. */
  kind?: "city" | "coastal" | "island" | "nature";
  /** English Wikipedia article title for the content importer (defaults to the city name). */
  wiki?: string;
}

const A = (name: string, lat: number, lng: number, tags: string[], durationMin = 90, neighborhood?: string): SeedPlace => ({ name, lat, lng, tags, durationMin, neighborhood, kind: "attraction" });
const X = (name: string, lat: number, lng: number, tags: string[], durationMin = 90, neighborhood?: string): SeedPlace => ({ name, lat, lng, tags, durationMin, neighborhood, kind: "activity" });

export const COUNTRY_CONTINENT = COUNTRY_INFO;

const CORE_DESTINATIONS: SeedDestination[] = [
  /* ───────────── Europe ───────────── */
  {
    slug: "paris", city: "Paris", country: "FR", continent: "europe", lat: 48.8566, lng: 2.3522, tz: "Europe/Paris",
    summary: "World-class museums, café culture and grand boulevards along the Seine.",
    bestTime: "April–June and September–October", bestMonths: [4, 5, 6, 9, 10], days: [3, 5], budget: "premium", climate: "oceanic",
    styles: ["city_break", "culture", "romantic", "food"], experiences: ["museums", "architecture", "food", "shopping", "photography"], popularity: 98, featured: true,
    neighborhoods: ["Le Marais", "Saint-Germain-des-Prés", "Montmartre", "Latin Quarter", "Canal Saint-Martin"],
    places: [
      A("Eiffel Tower", 48.8584, 2.2945, ["architecture", "photography", "landmark"], 120, "7th arrondissement"),
      A("Louvre Museum", 48.8606, 2.3376, ["museums", "culture", "history"], 180, "1st arrondissement"),
      A("Musée d'Orsay", 48.86, 2.3266, ["museums", "culture"], 150, "Saint-Germain-des-Prés"),
      A("Notre-Dame Cathedral", 48.853, 2.3499, ["architecture", "history"], 60, "Île de la Cité"),
      A("Sainte-Chapelle", 48.8554, 2.345, ["architecture", "history"], 45, "Île de la Cité"),
      A("Montmartre & Sacré-Cœur", 48.8867, 2.3431, ["local", "photography", "culture", "architecture"], 120, "Montmartre"),
      A("Le Marais", 48.859, 2.362, ["shopping", "food", "local", "hidden_gems"], 120, "Le Marais"),
      A("Luxembourg Gardens", 48.8462, 2.3372, ["nature", "relaxation", "family"], 60, "Saint-Germain-des-Prés"),
      A("Arc de Triomphe", 48.8738, 2.295, ["architecture", "history", "photography"], 60, "8th arrondissement"),
      X("Seine river cruise", 48.8575, 2.341, ["relaxation", "photography", "family"], 60, "Pont Neuf"),
      A("Canal Saint-Martin", 48.871, 2.365, ["local", "hidden_gems", "relaxation"], 60, "10th arrondissement"),
    ],
  },
  {
    slug: "rome", city: "Rome", country: "IT", continent: "europe", lat: 41.9028, lng: 12.4964, tz: "Europe/Rome",
    summary: "Ancient ruins, Baroque piazzas and some of the world's most celebrated art.",
    bestTime: "April–May and September–October", bestMonths: [4, 5, 9, 10], days: [3, 5], budget: "mid", climate: "mediterranean",
    styles: ["city_break", "culture", "food", "romantic"], experiences: ["history", "architecture", "museums", "food"], popularity: 96, featured: true,
    neighborhoods: ["Centro Storico", "Trastevere", "Monti", "Prati", "Testaccio"],
    places: [
      A("Colosseum", 41.8902, 12.4922, ["history", "architecture", "landmark"], 120, "Monti"),
      A("Roman Forum & Palatine Hill", 41.8925, 12.4853, ["history", "architecture"], 120, "Monti"),
      A("Pantheon", 41.8986, 12.4769, ["architecture", "history"], 45, "Centro Storico"),
      A("Trevi Fountain", 41.9009, 12.4833, ["architecture", "photography"], 30, "Trevi"),
      A("Vatican Museums & Sistine Chapel", 41.9065, 12.4536, ["museums", "culture", "history"], 180, "Vatican"),
      A("St. Peter's Basilica", 41.9022, 12.4539, ["architecture", "history", "culture"], 90, "Vatican"),
      A("Piazza Navona", 41.8992, 12.4731, ["architecture", "local", "photography"], 45, "Centro Storico"),
      A("Trastevere", 41.8897, 12.4708, ["food", "local", "nightlife", "hidden_gems"], 120, "Trastevere"),
      A("Spanish Steps", 41.906, 12.4828, ["architecture", "shopping"], 30, "Tridente"),
      A("Villa Borghese & Galleria Borghese", 41.9142, 12.4922, ["museums", "nature", "relaxation"], 150, "Pinciano"),
    ],
  },
  {
    slug: "milan", city: "Milan", country: "IT", continent: "europe", lat: 45.4642, lng: 9.19, tz: "Europe/Rome",
    summary: "Italy's capital of design and fashion, with a Gothic cathedral and Leonardo's Last Supper.",
    bestTime: "April–June and September–October", bestMonths: [4, 5, 6, 9, 10], days: [2, 3], budget: "premium", climate: "continental",
    styles: ["city_break", "culture", "food", "luxury"], experiences: ["architecture", "shopping", "museums", "food", "nightlife"], popularity: 82,
    neighborhoods: ["Brera", "Navigli", "Porta Nuova", "Isola", "Centro Storico"],
    places: [
      A("Duomo di Milano", 45.4641, 9.1919, ["architecture", "history", "landmark"], 90, "Centro Storico"),
      A("Galleria Vittorio Emanuele II", 45.4659, 9.19, ["shopping", "architecture"], 45, "Centro Storico"),
      A("The Last Supper (Santa Maria delle Grazie)", 45.4659, 9.1709, ["museums", "culture", "history"], 45, "Magenta"),
      A("Sforza Castle", 45.4705, 9.1795, ["history", "museums"], 90, "Centro Storico"),
      A("Brera district & Pinacoteca", 45.4719, 9.188, ["museums", "local", "shopping"], 120, "Brera"),
      A("Navigli canals", 45.452, 9.176, ["nightlife", "food", "local"], 90, "Navigli"),
      A("Teatro alla Scala", 45.4674, 9.1895, ["culture", "architecture"], 60, "Centro Storico"),
      A("Parco Sempione", 45.473, 9.175, ["nature", "relaxation", "family"], 60, "Sempione"),
    ],
  },
  {
    slug: "florence", city: "Florence", country: "IT", continent: "europe", lat: 43.7696, lng: 11.2558, tz: "Europe/Rome",
    summary: "The cradle of the Renaissance, compact enough to explore on foot.",
    bestTime: "April–June and September–October", bestMonths: [4, 5, 6, 9, 10], days: [2, 4], budget: "mid", climate: "mediterranean",
    styles: ["culture", "romantic", "food"], experiences: ["museums", "architecture", "history", "food"], popularity: 85,
  },
  {
    slug: "amalfi-coast", city: "Amalfi Coast", country: "IT", continent: "europe", lat: 40.6333, lng: 14.6029, tz: "Europe/Rome",
    summary: "Cliffside villages, lemon groves and boat trips along a dramatic Mediterranean coastline.",
    bestTime: "May–June and September", bestMonths: [5, 6, 9], days: [3, 5], budget: "premium", climate: "mediterranean",
    styles: ["beach", "romantic", "nature", "luxury"], experiences: ["beaches", "hiking", "photography", "relaxation", "food"], popularity: 84, featured: true,
  },
  {
    slug: "lisbon", city: "Lisbon", country: "PT", continent: "europe", lat: 38.7223, lng: -9.1393, tz: "Europe/Lisbon",
    summary: "Hilly neighbourhoods, historic trams and Atlantic light on pastel façades.",
    bestTime: "March–June and September–October", bestMonths: [3, 4, 5, 6, 9, 10], days: [3, 4], budget: "mid", climate: "mediterranean",
    styles: ["city_break", "culture", "food", "budget"], experiences: ["architecture", "food", "nightlife", "photography", "local"], popularity: 88, featured: true,
    neighborhoods: ["Alfama", "Baixa", "Chiado", "Bairro Alto", "Belém"],
    places: [
      A("Belém Tower", 38.6916, -9.216, ["history", "architecture", "photography"], 60, "Belém"),
      A("Jerónimos Monastery", 38.6979, -9.2068, ["history", "architecture"], 90, "Belém"),
      A("Alfama district", 38.7114, -9.13, ["local", "photography", "hidden_gems"], 120, "Alfama"),
      A("São Jorge Castle", 38.7139, -9.1335, ["history", "photography"], 90, "Alfama"),
      X("Tram 28 ride", 38.7163, -9.136, ["local", "photography"], 45, "Martim Moniz"),
      A("LX Factory", 38.7037, -9.1785, ["shopping", "food", "local"], 90, "Alcântara"),
      A("Miradouro da Senhora do Monte", 38.7193, -9.1327, ["photography", "hidden_gems", "relaxation"], 30, "Graça"),
      A("Praça do Comércio", 38.7075, -9.1364, ["architecture", "history"], 30, "Baixa"),
    ],
  },
  {
    slug: "porto", city: "Porto", country: "PT", continent: "europe", lat: 41.1579, lng: -8.6291, tz: "Europe/Lisbon",
    summary: "Riverside terraces, azulejo-tiled churches and port wine cellars across the Douro.",
    bestTime: "May–September", bestMonths: [5, 6, 7, 8, 9], days: [2, 3], budget: "budget", climate: "oceanic",
    styles: ["city_break", "food", "budget"], experiences: ["architecture", "food", "photography"], popularity: 74,
  },
  {
    slug: "barcelona", city: "Barcelona", country: "ES", continent: "europe", lat: 41.3874, lng: 2.1686, tz: "Europe/Madrid",
    summary: "Gaudí's architecture, Mediterranean beaches and a late-night food scene.",
    bestTime: "May–June and September–October", bestMonths: [5, 6, 9, 10], days: [3, 5], budget: "mid", climate: "mediterranean",
    styles: ["city_break", "beach", "culture", "food"], experiences: ["architecture", "beaches", "food", "nightlife", "markets"], popularity: 94, featured: true,
    neighborhoods: ["Gothic Quarter", "El Born", "Eixample", "Gràcia", "Barceloneta"],
    places: [
      A("Sagrada Família", 41.4036, 2.1744, ["architecture", "culture", "landmark"], 90, "Eixample"),
      A("Park Güell", 41.4145, 2.1527, ["architecture", "nature", "photography"], 90, "Gràcia"),
      A("Gothic Quarter", 41.3833, 2.1777, ["history", "local", "hidden_gems"], 90, "Ciutat Vella"),
      A("Casa Batlló", 41.3916, 2.1649, ["architecture", "museums"], 75, "Eixample"),
      A("La Boqueria Market", 41.3817, 2.1716, ["food", "markets", "local"], 60, "El Raval"),
      A("Montjuïc", 41.3636, 2.158, ["nature", "museums", "photography"], 120, "Montjuïc"),
      A("Barceloneta Beach", 41.3784, 2.1925, ["beaches", "relaxation", "family"], 120, "Barceloneta"),
      A("Picasso Museum", 41.3852, 2.181, ["museums", "culture"], 90, "El Born"),
    ],
  },
  {
    slug: "madrid", city: "Madrid", country: "ES", continent: "europe", lat: 40.4168, lng: -3.7038, tz: "Europe/Madrid",
    summary: "The Golden Triangle of art museums, leafy parks and lively tapas bars.",
    bestTime: "March–May and September–November", bestMonths: [3, 4, 5, 9, 10, 11], days: [2, 4], budget: "mid", climate: "continental",
    styles: ["city_break", "culture", "food"], experiences: ["museums", "food", "nightlife", "architecture"], popularity: 80,
  },
  {
    slug: "london", city: "London", country: "GB", continent: "europe", lat: 51.5074, lng: -0.1278, tz: "Europe/London",
    summary: "Royal landmarks, free world-class museums and distinctive neighbourhoods.",
    bestTime: "May–September", bestMonths: [5, 6, 7, 8, 9], days: [3, 5], budget: "premium", climate: "oceanic",
    styles: ["city_break", "culture", "family"], experiences: ["museums", "history", "shopping", "markets", "nightlife"], popularity: 95,
    neighborhoods: ["Westminster", "South Bank", "Covent Garden", "Shoreditch", "Camden"],
    places: [
      A("British Museum", 51.5194, -0.127, ["museums", "history", "culture"], 150, "Bloomsbury"),
      A("Tower of London", 51.5081, -0.0759, ["history", "architecture"], 150, "Tower Hill"),
      A("Westminster Abbey", 51.4993, -0.1273, ["history", "architecture"], 90, "Westminster"),
      A("Buckingham Palace", 51.5014, -0.1419, ["history", "photography"], 45, "Westminster"),
      A("Tate Modern", 51.5076, -0.0994, ["museums", "culture"], 120, "South Bank"),
      A("Borough Market", 51.5055, -0.091, ["food", "markets", "local"], 60, "Southwark"),
      A("Hyde Park", 51.5073, -0.1657, ["nature", "relaxation", "family"], 75, "Hyde Park"),
      A("Camden Market", 51.5413, -0.1463, ["shopping", "food", "local"], 90, "Camden"),
    ],
  },
  {
    slug: "amsterdam", city: "Amsterdam", country: "NL", continent: "europe", lat: 52.3676, lng: 4.9041, tz: "Europe/Amsterdam",
    summary: "Canal rings, Golden Age art and a city best explored by bicycle.",
    bestTime: "April–May and September", bestMonths: [4, 5, 9], days: [2, 4], budget: "premium", climate: "oceanic",
    styles: ["city_break", "culture"], experiences: ["museums", "architecture", "nightlife"], popularity: 86,
  },
  {
    slug: "berlin", city: "Berlin", country: "DE", continent: "europe", lat: 52.52, lng: 13.405, tz: "Europe/Berlin",
    summary: "Layered history, galleries and one of Europe's most creative nightlife scenes.",
    bestTime: "May–September", bestMonths: [5, 6, 7, 8, 9], days: [3, 4], budget: "mid", climate: "continental",
    styles: ["city_break", "culture", "budget"], experiences: ["history", "museums", "nightlife"], popularity: 81,
  },
  {
    slug: "vienna", city: "Vienna", country: "AT", continent: "europe", lat: 48.2082, lng: 16.3738, tz: "Europe/Vienna",
    summary: "Imperial palaces, coffee-house tradition and a rich classical music heritage.",
    bestTime: "April–May and September–October", bestMonths: [4, 5, 9, 10, 12], days: [2, 4], budget: "mid", climate: "continental",
    styles: ["city_break", "culture", "romantic"], experiences: ["museums", "architecture", "history"], popularity: 76,
  },
  {
    slug: "athens", city: "Athens", country: "GR", continent: "europe", lat: 37.9838, lng: 23.7275, tz: "Europe/Athens",
    summary: "The Acropolis above a lively modern city, with islands a ferry ride away.",
    bestTime: "April–June and September–October", bestMonths: [4, 5, 6, 9, 10], days: [2, 3], budget: "mid", climate: "mediterranean",
    styles: ["culture", "city_break"], experiences: ["history", "architecture", "food"], popularity: 79,
  },
  {
    slug: "santorini", city: "Santorini", country: "GR", continent: "europe", lat: 36.3932, lng: 25.4615, tz: "Europe/Athens",
    summary: "Whitewashed villages on a volcanic caldera, famous for its sunsets.",
    bestTime: "May–June and September–October", bestMonths: [5, 6, 9, 10], days: [3, 4], budget: "premium", climate: "mediterranean",
    styles: ["romantic", "beach", "luxury"], experiences: ["photography", "beaches", "relaxation", "hiking"], popularity: 87,
    neighborhoods: ["Oia", "Fira", "Imerovigli", "Pyrgos"],
    places: [
      A("Oia village", 36.4618, 25.3753, ["photography", "romantic", "architecture"], 150, "Oia"),
      A("Fira town", 36.4167, 25.4317, ["shopping", "food", "photography"], 120, "Fira"),
      A("Akrotiri archaeological site", 36.3514, 25.4033, ["history", "museums"], 90, "Akrotiri"),
      A("Red Beach", 36.3486, 25.3944, ["beaches", "nature"], 90, "Akrotiri"),
      X("Fira–Oia caldera hike", 36.4325, 25.423, ["hiking", "nature", "photography", "adventure"], 180, "Imerovigli"),
      A("Pyrgos village", 36.3833, 25.45, ["local", "hidden_gems", "architecture"], 75, "Pyrgos"),
    ],
  },
  {
    slug: "prague", city: "Prague", country: "CZ", continent: "europe", lat: 50.0755, lng: 14.4378, tz: "Europe/Prague",
    summary: "A remarkably preserved old town of spires, bridges and castle views.",
    bestTime: "April–May and September–October", bestMonths: [4, 5, 9, 10], days: [2, 4], budget: "budget", climate: "continental",
    styles: ["city_break", "culture", "budget", "romantic"], experiences: ["architecture", "history", "nightlife"], popularity: 80,
  },
  {
    slug: "istanbul", city: "Istanbul", country: "TR", continent: "europe", lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul",
    summary: "Where Europe meets Asia: Byzantine and Ottoman monuments, bazaars and Bosphorus ferries.",
    bestTime: "April–May and September–November", bestMonths: [4, 5, 9, 10, 11], days: [3, 5], budget: "mid", climate: "mediterranean",
    styles: ["city_break", "culture", "food"], experiences: ["history", "architecture", "markets", "food"], popularity: 90, featured: true,
    neighborhoods: ["Sultanahmet", "Beyoğlu", "Karaköy", "Kadıköy", "Balat"],
    places: [
      A("Hagia Sophia", 41.0086, 28.9802, ["history", "architecture", "culture"], 75, "Sultanahmet"),
      A("Blue Mosque (Sultan Ahmed Mosque)", 41.0054, 28.9768, ["architecture", "culture"], 45, "Sultanahmet"),
      A("Topkapı Palace", 41.0115, 28.9834, ["history", "museums"], 150, "Sultanahmet"),
      A("Basilica Cistern", 41.0084, 28.9779, ["history", "architecture"], 45, "Sultanahmet"),
      A("Grand Bazaar", 41.0107, 28.9681, ["shopping", "markets", "local"], 90, "Beyazıt"),
      A("Spice Bazaar", 41.0165, 28.9706, ["food", "markets"], 45, "Eminönü"),
      A("Süleymaniye Mosque", 41.0161, 28.964, ["architecture", "photography"], 60, "Süleymaniye"),
      A("Galata Tower", 41.0256, 28.9744, ["photography", "history"], 60, "Karaköy"),
      X("Bosphorus ferry cruise", 41.017, 28.974, ["relaxation", "photography"], 120, "Eminönü"),
    ],
  },

  /* ───────────── Middle East & North Africa ───────────── */
  {
    slug: "dubai", city: "Dubai", country: "AE", continent: "mena", lat: 25.2048, lng: 55.2708, tz: "Asia/Dubai",
    summary: "Record-breaking architecture, desert landscapes and the historic creek-side souks.",
    bestTime: "November–March", bestMonths: [11, 12, 1, 2, 3], days: [3, 5], budget: "premium", climate: "desert",
    styles: ["luxury", "family", "beach", "city_break"], experiences: ["shopping", "architecture", "beaches", "markets"], popularity: 91, featured: true,
    neighborhoods: ["Downtown", "Al Fahidi", "Deira", "Dubai Marina", "Jumeirah"],
    places: [
      A("Burj Khalifa", 25.1972, 55.2744, ["architecture", "photography", "landmark"], 90, "Downtown"),
      A("Dubai Mall & Dubai Fountain", 25.1985, 55.2796, ["shopping", "family"], 120, "Downtown"),
      A("Al Fahidi Historical Neighbourhood", 25.2637, 55.2972, ["history", "culture", "local"], 90, "Bur Dubai"),
      X("Abra crossing on Dubai Creek", 25.2687, 55.2984, ["local", "photography"], 30, "Deira"),
      A("Gold & Spice Souks", 25.287, 55.2963, ["markets", "shopping", "local"], 75, "Deira"),
      A("Jumeirah Mosque", 25.234, 55.2654, ["architecture", "culture"], 60, "Jumeirah"),
      A("Museum of the Future", 25.2192, 55.282, ["museums", "architecture", "family"], 90, "Trade Centre"),
      A("Dubai Marina walk", 25.0805, 55.1403, ["photography", "relaxation", "nightlife"], 90, "Dubai Marina"),
    ],
  },
  {
    slug: "abu-dhabi", city: "Abu Dhabi", country: "AE", continent: "mena", lat: 24.4539, lng: 54.3773, tz: "Asia/Dubai",
    summary: "Grand mosque architecture, island museums and calm Gulf beaches.",
    bestTime: "November–March", bestMonths: [11, 12, 1, 2, 3], days: [2, 3], budget: "premium", climate: "desert",
    styles: ["culture", "family", "luxury"], experiences: ["architecture", "museums", "beaches"], popularity: 70,
  },
  {
    slug: "beirut", city: "Beirut", country: "LB", continent: "mena", lat: 33.8938, lng: 35.5018, tz: "Asia/Beirut",
    summary: "A Mediterranean capital known for its food, seafront Corniche and resilient creative scene.",
    bestTime: "April–June and September–October", bestMonths: [4, 5, 6, 9, 10], days: [2, 4], budget: "mid", climate: "mediterranean",
    styles: ["food", "culture", "city_break"], experiences: ["food", "nightlife", "history"], popularity: 58,
  },
  {
    slug: "amman", city: "Amman", country: "JO", continent: "mena", lat: 31.9454, lng: 35.9284, tz: "Asia/Amman",
    summary: "Roman ruins on a hillside capital and a gateway to Petra and Wadi Rum.",
    bestTime: "March–May and September–November", bestMonths: [3, 4, 5, 9, 10, 11], days: [2, 3], budget: "mid", climate: "subtropical",
    styles: ["culture", "adventure"], experiences: ["history", "food", "hiking"], popularity: 60,
  },
  {
    slug: "cairo", city: "Cairo", country: "EG", continent: "mena", lat: 30.0444, lng: 31.2357, tz: "Africa/Cairo",
    summary: "The Giza pyramids, Islamic Cairo's monuments and life along the Nile.",
    bestTime: "October–April", bestMonths: [10, 11, 12, 1, 2, 3, 4], days: [3, 4], budget: "budget", climate: "desert",
    styles: ["culture", "adventure", "budget"], experiences: ["history", "museums", "markets"], popularity: 78,
  },
  {
    slug: "marrakech", city: "Marrakech", country: "MA", continent: "mena", lat: 31.6295, lng: -7.9811, tz: "Africa/Casablanca",
    summary: "A labyrinthine medina of souks, riads and gardens at the foot of the Atlas Mountains.",
    bestTime: "March–May and September–November", bestMonths: [3, 4, 5, 9, 10, 11], days: [3, 4], budget: "budget", climate: "desert",
    styles: ["culture", "adventure", "food", "budget"], experiences: ["markets", "architecture", "food", "photography"], popularity: 83, featured: true,
    neighborhoods: ["Medina", "Gueliz", "Kasbah", "Mellah"],
    places: [
      A("Jemaa el-Fnaa square", 31.6258, -7.9891, ["local", "food", "nightlife"], 90, "Medina"),
      A("Koutoubia Mosque (exterior & gardens)", 31.6237, -7.9936, ["architecture", "photography"], 30, "Medina"),
      A("Bahia Palace", 31.6216, -7.9831, ["architecture", "history"], 75, "Mellah"),
      A("Jardin Majorelle", 31.6417, -8.0033, ["nature", "photography", "museums"], 90, "Gueliz"),
      A("Ben Youssef Madrasa", 31.6318, -7.9862, ["architecture", "history"], 60, "Medina"),
      A("Saadian Tombs", 31.6173, -7.9886, ["history", "architecture"], 45, "Kasbah"),
      A("Souks of the Medina", 31.6295, -7.987, ["shopping", "markets", "local", "hidden_gems"], 120, "Medina"),
    ],
  },
  {
    slug: "casablanca", city: "Casablanca", country: "MA", continent: "mena", lat: 33.5731, lng: -7.5898, tz: "Africa/Casablanca",
    summary: "Morocco's Atlantic metropolis, home to the vast Hassan II Mosque and Art Deco streets.",
    bestTime: "April–October", bestMonths: [4, 5, 6, 9, 10], days: [1, 2], budget: "mid", climate: "mediterranean",
    styles: ["city_break", "culture"], experiences: ["architecture", "food"], popularity: 55,
  },
  {
    slug: "doha", city: "Doha", country: "QA", continent: "mena", lat: 25.2854, lng: 51.531, tz: "Asia/Qatar",
    summary: "Striking museums, a waterfront Corniche and the restored Souq Waqif.",
    bestTime: "November–March", bestMonths: [11, 12, 1, 2, 3], days: [2, 3], budget: "premium", climate: "desert",
    styles: ["culture", "luxury", "family"], experiences: ["museums", "markets", "architecture"], popularity: 62,
  },
  {
    slug: "riyadh", city: "Riyadh", country: "SA", continent: "mena", lat: 24.7136, lng: 46.6753, tz: "Asia/Riyadh",
    summary: "A fast-changing capital with the historic Diriyah district and desert escarpments nearby.",
    bestTime: "November–February", bestMonths: [11, 12, 1, 2], days: [2, 3], budget: "premium", climate: "desert",
    styles: ["culture", "city_break"], experiences: ["history", "architecture", "markets"], popularity: 55,
  },
  {
    slug: "muscat", city: "Muscat", country: "OM", continent: "mena", lat: 23.588, lng: 58.3829, tz: "Asia/Muscat",
    summary: "Low-rise whitewashed city between mountains and sea, with a grand mosque and old souk.",
    bestTime: "October–April", bestMonths: [10, 11, 12, 1, 2, 3, 4], days: [2, 4], budget: "mid", climate: "desert",
    styles: ["culture", "nature", "beach"], experiences: ["architecture", "beaches", "markets", "hiking"], popularity: 57,
  },

  /* ───────────── Asia ───────────── */
  {
    slug: "tokyo", city: "Tokyo", country: "JP", continent: "asia", lat: 35.6762, lng: 139.6503, tz: "Asia/Tokyo",
    summary: "Neon districts, serene shrines and an extraordinary food culture in one vast metropolis.",
    bestTime: "March–May and October–November", bestMonths: [3, 4, 5, 10, 11], days: [4, 6], budget: "mid", climate: "subtropical",
    styles: ["city_break", "food", "culture", "family"], experiences: ["food", "shopping", "architecture", "nightlife", "museums"], popularity: 97, featured: true,
    neighborhoods: ["Shibuya", "Shinjuku", "Asakusa", "Ginza", "Shimokitazawa"],
    places: [
      A("Sensō-ji Temple", 35.7148, 139.7967, ["culture", "history", "architecture"], 75, "Asakusa"),
      A("Meiji Jingu Shrine", 35.6764, 139.6993, ["culture", "nature"], 75, "Harajuku"),
      A("Shibuya Crossing", 35.6595, 139.7005, ["photography", "local", "shopping"], 45, "Shibuya"),
      A("Tsukiji Outer Market", 35.6655, 139.7707, ["food", "markets", "local"], 75, "Tsukiji"),
      A("Shinjuku Gyoen National Garden", 35.6852, 139.71, ["nature", "relaxation"], 90, "Shinjuku"),
      A("Tokyo National Museum", 35.7188, 139.7765, ["museums", "history", "culture"], 120, "Ueno"),
      A("Akihabara", 35.6984, 139.7731, ["shopping", "local"], 90, "Akihabara"),
      A("Omoide Yokocho", 35.6938, 139.6995, ["food", "nightlife", "hidden_gems"], 60, "Shinjuku"),
    ],
  },
  {
    slug: "kyoto", city: "Kyoto", country: "JP", continent: "asia", lat: 35.0116, lng: 135.7681, tz: "Asia/Tokyo",
    summary: "Thousands of temples and shrines, traditional machiya streets and seasonal gardens.",
    bestTime: "March–May and October–November", bestMonths: [3, 4, 5, 10, 11], days: [3, 4], budget: "mid", climate: "subtropical",
    styles: ["culture", "romantic", "nature"], experiences: ["history", "architecture", "photography", "food"], popularity: 90, featured: true,
    neighborhoods: ["Gion", "Higashiyama", "Arashiyama", "Downtown (Kawaramachi)"],
    places: [
      A("Fushimi Inari Taisha", 34.9671, 135.7727, ["culture", "photography", "hiking"], 120, "Fushimi"),
      A("Kiyomizu-dera", 34.9949, 135.785, ["culture", "architecture", "photography"], 90, "Higashiyama"),
      A("Kinkaku-ji (Golden Pavilion)", 35.0394, 135.7292, ["architecture", "photography"], 60, "Kita"),
      A("Arashiyama Bamboo Grove", 35.017, 135.6713, ["nature", "photography"], 60, "Arashiyama"),
      A("Gion district", 35.0037, 135.7788, ["local", "culture", "photography"], 90, "Gion"),
      A("Nishiki Market", 35.005, 135.7649, ["food", "markets"], 60, "Downtown"),
      A("Philosopher's Path & Ginkaku-ji", 35.027, 135.7982, ["nature", "relaxation", "hidden_gems"], 120, "Sakyo"),
      A("Nijō Castle", 35.0142, 135.7482, ["history", "architecture"], 90, "Nakagyo"),
    ],
  },
  {
    slug: "seoul", city: "Seoul", country: "KR", continent: "asia", lat: 37.5665, lng: 126.978, tz: "Asia/Seoul",
    summary: "Joseon palaces beside cutting-edge design, street food and late-night markets.",
    bestTime: "April–June and September–November", bestMonths: [4, 5, 6, 9, 10, 11], days: [3, 5], budget: "mid", climate: "continental",
    styles: ["city_break", "food", "culture"], experiences: ["food", "shopping", "history", "nightlife"], popularity: 84,
  },
  {
    slug: "bangkok", city: "Bangkok", country: "TH", continent: "asia", lat: 13.7563, lng: 100.5018, tz: "Asia/Bangkok",
    summary: "Gilded temples, river life and one of the world's great street-food cities.",
    bestTime: "November–February", bestMonths: [11, 12, 1, 2], days: [3, 4], budget: "budget", climate: "tropical",
    styles: ["city_break", "food", "budget"], experiences: ["food", "markets", "nightlife", "architecture"], popularity: 89,
  },
  {
    slug: "singapore", city: "Singapore", country: "SG", continent: "asia", lat: 1.3521, lng: 103.8198, tz: "Asia/Singapore",
    summary: "A green, efficient city-state famous for hawker centres and futuristic gardens.",
    bestTime: "February–April", bestMonths: [2, 3, 4], days: [2, 4], budget: "premium", climate: "tropical",
    styles: ["city_break", "family", "food"], experiences: ["food", "architecture", "shopping"], popularity: 86,
  },
  {
    slug: "kuala-lumpur", city: "Kuala Lumpur", country: "MY", continent: "asia", lat: 3.139, lng: 101.6869, tz: "Asia/Kuala_Lumpur",
    summary: "Landmark towers, multicultural food streets and nearby limestone caves.",
    bestTime: "May–July and December–February", bestMonths: [5, 6, 7, 12, 1, 2], days: [2, 3], budget: "budget", climate: "tropical",
    styles: ["city_break", "food", "budget"], experiences: ["food", "shopping", "architecture"], popularity: 72,
  },
  {
    slug: "bali", city: "Bali", country: "ID", continent: "asia", lat: -8.5069, lng: 115.2625, tz: "Asia/Makassar",
    summary: "Rice terraces, Hindu water temples and surf beaches, with Ubud as a cultural base.",
    bestTime: "April–October", bestMonths: [4, 5, 6, 7, 8, 9, 10], days: [5, 8], budget: "budget", climate: "tropical",
    styles: ["beach", "nature", "romantic", "adventure"], experiences: ["beaches", "relaxation", "hiking", "photography"], popularity: 92, featured: true,
    neighborhoods: ["Ubud", "Canggu", "Seminyak", "Uluwatu", "Sanur"],
    places: [
      A("Tegallalang Rice Terraces", -8.4335, 115.2794, ["nature", "photography"], 90, "Ubud"),
      A("Sacred Monkey Forest Sanctuary", -8.5188, 115.2585, ["nature", "family"], 75, "Ubud"),
      A("Ubud Palace", -8.5068, 115.2625, ["culture", "history"], 45, "Ubud"),
      A("Tirta Empul Temple", -8.4153, 115.3153, ["culture", "history"], 90, "Tampaksiring"),
      X("Campuhan Ridge Walk", -8.503, 115.254, ["hiking", "nature", "relaxation"], 75, "Ubud"),
      A("Tanah Lot Temple", -8.6212, 115.0868, ["culture", "photography", "beaches"], 90, "Tabanan"),
      A("Uluwatu Temple", -8.8291, 115.0849, ["culture", "photography"], 90, "Uluwatu"),
    ],
  },
  {
    slug: "jakarta", city: "Jakarta", country: "ID", continent: "asia", lat: -6.2088, lng: 106.8456, tz: "Asia/Jakarta",
    summary: "Indonesia's sprawling capital with a Dutch-colonial old town and a big food scene.",
    bestTime: "June–September", bestMonths: [6, 7, 8, 9], days: [1, 3], budget: "budget", climate: "tropical",
    styles: ["city_break", "food"], experiences: ["food", "shopping", "history"], popularity: 50,
  },
  {
    slug: "hong-kong", city: "Hong Kong", country: "HK", continent: "asia", lat: 22.3193, lng: 114.1694, tz: "Asia/Hong_Kong",
    summary: "A dramatic harbour skyline, dim sum, hiking trails and outlying islands.",
    bestTime: "October–December", bestMonths: [10, 11, 12], days: [3, 4], budget: "premium", climate: "subtropical",
    styles: ["city_break", "food", "adventure"], experiences: ["food", "hiking", "shopping", "photography"], popularity: 82,
  },

  /* ───────────── North America ───────────── */
  {
    slug: "new-york", city: "New York", country: "US", continent: "north_america", lat: 40.7128, lng: -74.006, tz: "America/New_York",
    summary: "Iconic skyline, world-renowned museums and distinctive neighbourhoods across five boroughs.",
    bestTime: "April–June and September–November", bestMonths: [4, 5, 6, 9, 10, 11, 12], days: [4, 6], budget: "premium", climate: "continental",
    styles: ["city_break", "culture", "food", "family"], experiences: ["museums", "architecture", "food", "shopping", "nightlife"], popularity: 97, featured: true,
    neighborhoods: ["Midtown", "Lower Manhattan", "Greenwich Village", "Williamsburg", "Upper West Side"],
    places: [
      A("Central Park", 40.7829, -73.9654, ["nature", "relaxation", "family"], 120, "Central Park"),
      A("The Metropolitan Museum of Art", 40.7794, -73.9632, ["museums", "culture"], 180, "Upper East Side"),
      X("Statue of Liberty & Ellis Island ferry", 40.6892, -74.0445, ["history", "photography", "family"], 240, "Liberty Island"),
      A("Brooklyn Bridge walk", 40.7061, -73.9969, ["architecture", "photography"], 60, "DUMBO"),
      A("Times Square", 40.758, -73.9855, ["local", "photography", "shopping"], 45, "Midtown"),
      A("The High Line", 40.748, -74.0048, ["nature", "architecture", "hidden_gems"], 75, "Chelsea"),
      A("9/11 Memorial & Museum", 40.7115, -74.0134, ["history", "museums"], 120, "Lower Manhattan"),
      A("Museum of Modern Art (MoMA)", 40.7614, -73.9776, ["museums", "culture"], 120, "Midtown"),
      A("Empire State Building", 40.7484, -73.9857, ["architecture", "photography"], 75, "Midtown"),
    ],
  },
  {
    slug: "los-angeles", city: "Los Angeles", country: "US", continent: "north_america", lat: 34.0522, lng: -118.2437, tz: "America/Los_Angeles",
    summary: "Beaches, hillside viewpoints, film history and diverse food across a sprawling region.",
    bestTime: "March–May and September–November", bestMonths: [3, 4, 5, 9, 10, 11], days: [3, 5], budget: "premium", climate: "mediterranean",
    styles: ["beach", "city_break", "family"], experiences: ["beaches", "food", "shopping", "museums"], popularity: 85,
  },
  {
    slug: "san-francisco", city: "San Francisco", country: "US", continent: "north_america", lat: 37.7749, lng: -122.4194, tz: "America/Los_Angeles",
    summary: "Steep hills, cable cars, the Golden Gate Bridge and a strong food culture.",
    bestTime: "September–November", bestMonths: [9, 10, 11], days: [2, 4], budget: "premium", climate: "mediterranean",
    styles: ["city_break", "food", "nature"], experiences: ["architecture", "food", "hiking"], popularity: 80,
  },
  {
    slug: "miami", city: "Miami", country: "US", continent: "north_america", lat: 25.7617, lng: -80.1918, tz: "America/New_York",
    summary: "Art Deco beachfront, Latin American culture and colourful street art.",
    bestTime: "December–April", bestMonths: [12, 1, 2, 3, 4], days: [3, 4], budget: "premium", climate: "tropical",
    styles: ["beach", "city_break", "luxury"], experiences: ["beaches", "nightlife", "food", "architecture"], popularity: 78,
  },
  {
    slug: "toronto", city: "Toronto", country: "CA", continent: "north_america", lat: 43.6532, lng: -79.3832, tz: "America/Toronto",
    summary: "A multicultural lakeside city of distinct neighbourhoods, markets and islands.",
    bestTime: "May–October", bestMonths: [5, 6, 7, 8, 9, 10], days: [2, 4], budget: "mid", climate: "continental",
    styles: ["city_break", "food", "family"], experiences: ["food", "museums", "markets"], popularity: 70,
  },
  {
    slug: "vancouver", city: "Vancouver", country: "CA", continent: "north_america", lat: 49.2827, lng: -123.1207, tz: "America/Vancouver",
    summary: "Seawall cycling, forested parks and mountains a short drive from downtown.",
    bestTime: "June–September", bestMonths: [6, 7, 8, 9], days: [3, 4], budget: "premium", climate: "oceanic",
    styles: ["nature", "adventure", "city_break"], experiences: ["hiking", "food", "photography"], popularity: 72,
  },
  {
    slug: "montreal", city: "Montreal", country: "CA", continent: "north_america", lat: 45.5019, lng: -73.5674, tz: "America/Toronto",
    summary: "French-speaking charm, festivals, cobbled Old Montreal and a famed bagel rivalry.",
    bestTime: "May–October", bestMonths: [5, 6, 7, 8, 9, 10], days: [2, 4], budget: "mid", climate: "continental",
    styles: ["city_break", "food", "culture"], experiences: ["food", "architecture", "nightlife"], popularity: 68,
  },

  /* ───────────── South America ───────────── */
  {
    slug: "rio-de-janeiro", city: "Rio de Janeiro", country: "BR", continent: "south_america", lat: -22.9068, lng: -43.1729, tz: "America/Sao_Paulo",
    summary: "Mountains plunging into the Atlantic, legendary beaches and samba culture.",
    bestTime: "December–March (summer) and May–October (cooler, drier)", bestMonths: [5, 6, 7, 8, 9, 10], days: [4, 6], budget: "mid", climate: "tropical",
    styles: ["beach", "adventure", "city_break"], experiences: ["beaches", "hiking", "nightlife", "photography"], popularity: 88, featured: true,
    neighborhoods: ["Copacabana", "Ipanema", "Santa Teresa", "Lapa", "Botafogo"],
    places: [
      A("Christ the Redeemer", -22.9519, -43.2105, ["landmark", "photography", "culture"], 120, "Corcovado"),
      X("Sugarloaf Mountain cable car", -22.9486, -43.1566, ["photography", "nature"], 120, "Urca"),
      A("Copacabana Beach", -22.9711, -43.1822, ["beaches", "relaxation", "local"], 120, "Copacabana"),
      A("Ipanema Beach", -22.9868, -43.205, ["beaches", "relaxation"], 120, "Ipanema"),
      A("Selarón Steps", -22.9153, -43.1793, ["photography", "hidden_gems"], 30, "Lapa"),
      A("Santa Teresa", -22.9213, -43.1874, ["local", "hidden_gems", "food"], 90, "Santa Teresa"),
      A("Rio de Janeiro Botanical Garden", -22.9676, -43.2246, ["nature", "relaxation"], 90, "Jardim Botânico"),
      A("Museum of Tomorrow", -22.8944, -43.1794, ["museums", "architecture"], 90, "Centro"),
    ],
  },
  {
    slug: "sao-paulo", city: "São Paulo", country: "BR", continent: "south_america", lat: -23.5505, lng: -46.6333, tz: "America/Sao_Paulo",
    summary: "South America's largest city, known for art museums, nightlife and its restaurant scene.",
    bestTime: "March–May and September–November", bestMonths: [3, 4, 5, 9, 10, 11], days: [2, 4], budget: "mid", climate: "subtropical",
    styles: ["city_break", "food"], experiences: ["food", "museums", "nightlife"], popularity: 66,
  },
  {
    slug: "buenos-aires", city: "Buenos Aires", country: "AR", continent: "south_america", lat: -34.6037, lng: -58.3816, tz: "America/Argentina/Buenos_Aires",
    summary: "European-style boulevards, tango halls and late dinners in parrillas.",
    bestTime: "March–May and September–November", bestMonths: [3, 4, 5, 9, 10, 11], days: [3, 5], budget: "budget", climate: "subtropical",
    styles: ["city_break", "food", "culture", "romantic"], experiences: ["food", "nightlife", "architecture"], popularity: 77,
  },
  {
    slug: "lima", city: "Lima", country: "PE", continent: "south_america", lat: -12.0464, lng: -77.0428, tz: "America/Lima",
    summary: "A clifftop capital celebrated for ceviche and some of the world's acclaimed kitchens.",
    bestTime: "December–April", bestMonths: [12, 1, 2, 3, 4], days: [2, 3], budget: "mid", climate: "desert",
    styles: ["food", "city_break"], experiences: ["food", "history", "museums"], popularity: 64,
  },
  {
    slug: "santiago", city: "Santiago", country: "CL", continent: "south_america", lat: -33.4489, lng: -70.6693, tz: "America/Santiago",
    summary: "A city framed by the Andes, close to vineyards and ski slopes.",
    bestTime: "September–November and March–May", bestMonths: [9, 10, 11, 3, 4, 5], days: [2, 4], budget: "mid", climate: "mediterranean",
    styles: ["city_break", "nature", "food"], experiences: ["food", "hiking", "museums"], popularity: 60,
  },

  /* ───────────── Africa ───────────── */
  {
    slug: "cape-town", city: "Cape Town", country: "ZA", continent: "africa", lat: -33.9249, lng: 18.4241, tz: "Africa/Johannesburg",
    summary: "Table Mountain, wild coastlines and winelands, all within reach of the city.",
    bestTime: "October–April", bestMonths: [10, 11, 12, 1, 2, 3, 4], days: [4, 6], budget: "mid", climate: "mediterranean",
    styles: ["nature", "adventure", "food", "beach"], experiences: ["hiking", "beaches", "food", "photography"], popularity: 86, featured: true,
    neighborhoods: ["City Bowl", "Bo-Kaap", "V&A Waterfront", "Camps Bay", "Woodstock"],
    places: [
      X("Table Mountain Aerial Cableway", -33.9486, 18.4031, ["nature", "photography", "hiking"], 150, "Table Mountain"),
      A("V&A Waterfront", -33.9036, 18.4207, ["shopping", "food", "family"], 120, "V&A Waterfront"),
      A("Bo-Kaap", -33.9205, 18.4153, ["culture", "photography", "local"], 60, "Bo-Kaap"),
      A("Kirstenbosch National Botanical Garden", -33.9875, 18.4327, ["nature", "relaxation"], 120, "Newlands"),
      X("Robben Island tour", -33.907, 18.419, ["history", "culture"], 240, "V&A Waterfront"),
      A("Boulders Beach penguin colony", -34.1975, 18.4513, ["nature", "beaches", "family"], 90, "Simon's Town"),
      A("Cape of Good Hope", -34.3568, 18.474, ["nature", "hiking", "photography"], 180, "Cape Point"),
      A("Zeitz MOCAA", -33.9083, 18.4227, ["museums", "architecture"], 90, "V&A Waterfront"),
    ],
  },
  {
    slug: "johannesburg", city: "Johannesburg", country: "ZA", continent: "africa", lat: -26.2041, lng: 28.0473, tz: "Africa/Johannesburg",
    summary: "South Africa's economic hub, with powerful history museums and a creative inner city.",
    bestTime: "March–May and September–November", bestMonths: [3, 4, 5, 9, 10, 11], days: [2, 3], budget: "mid", climate: "subtropical",
    styles: ["culture", "city_break"], experiences: ["history", "museums", "food"], popularity: 58,
  },
  {
    slug: "nairobi", city: "Nairobi", country: "KE", continent: "africa", lat: -1.2921, lng: 36.8219, tz: "Africa/Nairobi",
    summary: "A capital with a national park on its doorstep and a gateway to East African safaris.",
    bestTime: "June–October and January–February", bestMonths: [6, 7, 8, 9, 10, 1, 2], days: [2, 4], budget: "mid", climate: "subtropical",
    styles: ["nature", "adventure"], experiences: ["photography", "hiking"], popularity: 62,
  },
  {
    slug: "zanzibar", city: "Zanzibar", country: "TZ", continent: "africa", lat: -6.1659, lng: 39.2026, tz: "Africa/Dar_es_Salaam",
    summary: "Stone Town's Swahili architecture, spice farms and white-sand Indian Ocean beaches.",
    bestTime: "June–October and December–February", bestMonths: [6, 7, 8, 9, 10, 12, 1, 2], days: [4, 7], budget: "mid", climate: "tropical",
    styles: ["beach", "culture", "romantic"], experiences: ["beaches", "history", "relaxation"], popularity: 67,
  },
  {
    slug: "tunis", city: "Tunis", country: "TN", continent: "mena", lat: 36.8065, lng: 10.1815, tz: "Africa/Tunis",
    summary: "A historic medina, the Bardo's mosaics and the ruins of Carthage by the sea.",
    bestTime: "April–June and September–October", bestMonths: [4, 5, 6, 9, 10], days: [2, 3], budget: "budget", climate: "mediterranean",
    styles: ["culture", "budget"], experiences: ["history", "museums", "markets"], popularity: 50,
  },

  /* ───────────── Oceania ───────────── */
  {
    slug: "sydney", city: "Sydney", country: "AU", continent: "oceania", lat: -33.8688, lng: 151.2093, tz: "Australia/Sydney",
    summary: "A spectacular harbour, ocean beaches and coastal walks within the city.",
    bestTime: "September–November and March–May", bestMonths: [9, 10, 11, 3, 4, 5], days: [3, 5], budget: "premium", climate: "subtropical",
    styles: ["beach", "city_break", "family"], experiences: ["beaches", "architecture", "food", "hiking"], popularity: 88, featured: true,
    neighborhoods: ["The Rocks", "Circular Quay", "Surry Hills", "Bondi", "Manly"],
    places: [
      A("Sydney Opera House", -33.8568, 151.2153, ["architecture", "culture", "landmark"], 90, "Bennelong Point"),
      A("Sydney Harbour Bridge", -33.8523, 151.2108, ["architecture", "photography"], 60, "The Rocks"),
      A("The Rocks", -33.8599, 151.209, ["history", "local", "food"], 75, "The Rocks"),
      A("Royal Botanic Garden", -33.8642, 151.2166, ["nature", "relaxation"], 75, "Sydney CBD"),
      A("Bondi Beach", -33.8915, 151.2767, ["beaches", "relaxation"], 150, "Bondi"),
      A("Art Gallery of New South Wales", -33.8688, 151.2174, ["museums", "culture"], 90, "The Domain"),
      A("Taronga Zoo", -33.8436, 151.2411, ["family", "nature"], 180, "Mosman"),
      A("Darling Harbour", -33.8748, 151.2006, ["family", "food", "nightlife"], 75, "Darling Harbour"),
    ],
  },
  {
    slug: "melbourne", city: "Melbourne", country: "AU", continent: "oceania", lat: -37.8136, lng: 144.9631, tz: "Australia/Melbourne",
    summary: "Laneway cafés, street art, sport and an acclaimed dining scene.",
    bestTime: "March–May and September–November", bestMonths: [3, 4, 5, 9, 10, 11], days: [3, 4], budget: "mid", climate: "oceanic",
    styles: ["city_break", "food", "culture"], experiences: ["food", "museums", "shopping"], popularity: 76,
  },
  {
    slug: "auckland", city: "Auckland", country: "NZ", continent: "oceania", lat: -36.8485, lng: 174.7633, tz: "Pacific/Auckland",
    summary: "A harbour city of volcanic cones, islands and black-sand beaches.",
    bestTime: "December–April", bestMonths: [12, 1, 2, 3, 4], days: [2, 4], budget: "mid", climate: "oceanic",
    styles: ["nature", "adventure", "beach"], experiences: ["hiking", "beaches", "food"], popularity: 64,
  },
];

/** Wikipedia titles and kinds for the original 56 where they differ from the defaults. */
const CORE_META: Record<string, Pick<SeedDestination, "wiki" | "kind">> = {
  "amalfi-coast": { kind: "coastal", wiki: "Amalfi Coast" },
  santorini: { kind: "island", wiki: "Santorini" },
  bali: { kind: "island", wiki: "Bali" },
  zanzibar: { kind: "island", wiki: "Zanzibar" },
  "new-york": { wiki: "New York City" },
  "hong-kong": { wiki: "Hong Kong" },
  singapore: { wiki: "Singapore" },
  santiago: { wiki: "Santiago" },
  "sao-paulo": { wiki: "São Paulo" },
  lima: { wiki: "Lima" },
  doha: { wiki: "Doha" },
  vancouver: { wiki: "Vancouver" },
  "cape-town": { wiki: "Cape Town" },
};

/** The full catalogue: the original 56 plus the world collection (351 destinations). */
export const SEED_DESTINATIONS: SeedDestination[] = [
  ...CORE_DESTINATIONS.map((d) => ({ kind: "city" as const, wiki: d.city, ...d, ...CORE_META[d.slug] })),
  ...EUROPE,
  ...MENA_AFRICA,
  ...ASIA,
  ...AMERICAS_OCEANIA,
];

/** Hero slide image doubles as the destination card image when available. */
export function seedImageFor(slug: string) {
  const s = DEFAULT_HERO_SLIDES.find((h) => h.destinationSlug === slug);
  return s ? { url: s.imageUrl, alt: s.alt, creditName: s.creditName ?? null, creditUrl: s.creditUrl ?? null } : null;
}
