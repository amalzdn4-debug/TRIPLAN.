import "server-only";
import { z } from "zod";
import { features } from "@/lib/env";
import { scheduleDay, dayStartTime, enumerateDates } from "./engine";
import type { CandidatePlace, PlannedDay, PlannedStop, TripPreferences } from "./types";

/**
 * AI itinerary generation (Anthropic Claude). The model may ONLY schedule places from the
 * supplied candidate list (by id) — it cannot introduce venues, so every stop on the map is a
 * real record from our database. Meal blocks are areas, not invented restaurants. Any cost the
 * model gives is stored as an *estimate* and labelled as such.
 */
const AiStop = z.discriminatedUnion("type", [
  z.object({ type: z.literal("place"), placeId: z.string(), durationMin: z.number().int().min(15).max(480), note: z.string().max(400).optional() }),
  z.object({
    type: z.literal("meal"),
    mealType: z.enum(["breakfast", "lunch", "snack", "dinner", "drinks"]),
    nearPlaceId: z.string().optional(),
    note: z.string().max(400).optional(),
    costMin: z.number().nonnegative().optional(),
    costMax: z.number().nonnegative().optional(),
  }),
  z.object({ type: z.literal("break"), durationMin: z.number().int().min(15).max(300), note: z.string().max(400).optional() }),
]);
const AiPlan = z.object({ days: z.array(z.object({ title: z.string().max(120), stops: z.array(AiStop).max(14) })).min(1) });

const LANGUAGE_NAMES: Record<string, string> = { en: "English", ar: "Arabic", fr: "French", es: "Spanish", it: "Italian", zh: "Simplified Chinese", ru: "Russian", pt: "Portuguese" };

export async function generateWithAI(prefs: TripPreferences, places: CandidatePlace[], maxDays: number, locale: string): Promise<PlannedDay[] | null> {
  if (!features.ai() || places.length === 0) return null;
  const dates = enumerateDates(prefs.startDate, prefs.endDate, maxDays);
  const byId = new Map(places.map((p) => [p.id, p]));
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const candidates = places.map((p) => ({ id: p.id, name: p.name, area: p.neighborhood, lat: +p.lat.toFixed(4), lng: +p.lng.toFixed(4), tags: p.tags, typicalMinutes: p.durationMin }));
    const prompt = {
      task: "Plan a realistic day-by-day itinerary.",
      rules: [
        "Use ONLY places from `candidates`, referenced by their exact id. Never invent places, restaurants, prices or opening hours.",
        "Group geographically close places on the same day and order them to minimise travel.",
        "Each day: breakfast (unless arrival day), lunch around 12:00–14:00, an optional coffee/snack break, dinner around 19:00–21:00.",
        "Meals are areas, not named restaurants: use nearPlaceId to say which candidate the meal is near.",
        "Respect pace, interests, walking tolerance, children and food preferences. Leave free time; avoid overpacked days.",
        "Optional costMin/costMax for meals are rough per-person estimates in the trip currency; omit if unsure.",
        `Write titles and notes in ${LANGUAGE_NAMES[locale] ?? "English"}. Keep notes short and practical.`,
        `Return exactly ${dates.length} day(s). Respond with JSON only, matching the schema.`,
      ],
      schema: {
        days: [{ title: "string", stops: [{ type: "place", placeId: "id", durationMin: 90, note: "string?" }, { type: "meal", mealType: "breakfast|lunch|snack|dinner|drinks", nearPlaceId: "id?", note: "string?", costMin: 0, costMax: 0 }, { type: "break", durationMin: 60, note: "string?" }] }],
      },
      trip: {
        destination: prefs.destinationName,
        dates,
        travellers: { adults: prefs.adults, children: prefs.children, companions: prefs.companions },
        budgetCategory: prefs.budgetCategory,
        currency: prefs.currency,
        pace: prefs.pace,
        interests: prefs.interests,
        foodPreferences: prefs.foodPrefs,
        dietaryNotes: prefs.dietaryNotes,
        transport: prefs.transport,
        morning: prefs.morning,
        walking: prefs.walking,
        activityBalance: prefs.activityBalance,
        arrivalTime: prefs.departureTime,
        departureTime: prefs.returnTime,
        accommodation: prefs.accommodation.name ? { name: prefs.accommodation.name, lat: prefs.accommodation.lat, lng: prefs.accommodation.lng } : null,
      },
      candidates,
    };
    const msg = await client.messages.create({
      model: process.env.AI_MODEL || "claude-sonnet-5-5",
      max_tokens: 6000,
      system: "You are Triplan's itinerary planner. You output strictly valid JSON and never fabricate venues, prices or facts.",
      messages: [{ role: "user", content: JSON.stringify(prompt) }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const plan = AiPlan.parse(JSON.parse(json));

    const used = new Set<string>();
    return dates.map((date, i) => {
      const src = plan.days[i] ?? { title: prefs.destinationName, stops: [] };
      const stops: PlannedStop[] = [];
      for (const s of src.stops) {
        if (s.type === "place") {
          const p = byId.get(s.placeId);
          if (!p || used.has(p.id)) continue; // drop unknown or duplicate ids
          used.add(p.id);
          stops.push({ kind: p.kind === "activity" ? "activity" : "attraction", title: p.name, placeId: p.id, lat: p.lat, lng: p.lng, durationMin: s.durationMin, description: s.note ?? null, locked: false });
        } else if (s.type === "meal") {
          const near = (s.nearPlaceId && byId.get(s.nearPlaceId)) || null;
          const prevWithCoords = [...stops].reverse().find((x) => x.lat != null);
          const anchor = near ?? prevWithCoords ?? null;
          const hasCost = s.costMin != null && s.costMax != null && s.costMax >= s.costMin;
          stops.push({
            kind: s.mealType === "snack" ? "break" : "meal",
            mealType: s.mealType,
            title: near?.neighborhood ?? near?.name ?? (prevWithCoords?.title ?? ""),
            lat: anchor?.lat ?? null,
            lng: anchor?.lng ?? null,
            durationMin: s.mealType === "snack" ? 30 : s.mealType === "breakfast" ? 45 : s.mealType === "lunch" ? 75 : 90,
            description: s.note ?? null,
            costMin: hasCost ? s.costMin : null,
            costMax: hasCost ? s.costMax : null,
            costCurrency: hasCost ? prefs.currency : null,
            costBasis: hasCost ? "per_person" : null,
            costStatus: hasCost ? "estimated" : null,
            locked: false,
          });
        } else {
          const prev = [...stops].reverse().find((x) => x.lat != null);
          stops.push({ kind: "break", mealType: null, title: prev?.title ?? prefs.destinationName, lat: prev?.lat ?? null, lng: prev?.lng ?? null, durationMin: s.durationMin, description: s.note ?? null, locked: false });
        }
      }
      const startTime = dayStartTime(prefs);
      return { dayIndex: i, date, title: src.title || prefs.destinationName, startTime, stops: scheduleDay(stops, startTime, prefs.transport) };
    });
  } catch (err) {
    console.error("[ai] itinerary generation failed — falling back to rules engine", err);
    return null;
  }
}
