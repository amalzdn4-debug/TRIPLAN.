"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { detailedTripSchema, fastTripSchema, flattenErrors, formToObject, type ActionState } from "@/lib/validation";
import * as trips from "@/lib/trips";
import type { TripPreferences } from "@/lib/itinerary/types";

const ARRAY_KEYS = ["interests", "foodPrefs", "accommodationTypes"];

async function resolveDestination(slug: string) {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.destinations.id, city: schema.cities.name, countryCode: schema.cities.countryCode, lat: schema.cities.lat, lng: schema.cities.lng })
    .from(schema.destinations)
    .innerJoin(schema.cities, eq(schema.cities.id, schema.destinations.cityId))
    .where(and(eq(schema.destinations.slug, slug), eq(schema.destinations.published, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createTripAction(mode: "fast" | "detailed", _prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: { pathname: "/login", query: { next: `/plan/${mode}` } }, locale });
    return { ok: false };
  }
  const raw = formToObject(fd, ARRAY_KEYS);
  if (mode === "detailed" && typeof raw.participantsJson === "string") {
    try {
      raw.participants = JSON.parse(raw.participantsJson);
    } catch {
      raw.participants = [];
    }
  }
  const parsed = mode === "fast" ? fastTripSchema.safeParse(raw) : detailedTripSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
  if (!(await rateLimit("create-trip", 10, 60 * 60_000, user.id))) return { ok: false, message: "rateLimited" };

  const v = parsed.data as typeof parsed.data & Partial<import("zod").infer<typeof detailedTripSchema>>;
  const dest = await resolveDestination(v.destination);
  if (!dest) return { ok: false, errors: { destination: "unsupportedDestination" } };

  const prefs: TripPreferences = {
    destinationSlug: v.destination,
    destinationName: dest.city,
    departureCity: v.departureCity || null,
    startDate: v.startDate,
    endDate: v.endDate,
    departureTime: v.departureTime || null,
    returnTime: v.returnTime || null,
    adults: v.adults,
    children: v.children,
    companions: v.companions ?? null,
    budgetTotal: v.budgetTotal,
    budgetPerPerson: v.budgetPerPerson ?? null,
    currency: v.currency,
    budgetCategory: v.budgetCategory,
    budgetSplit: { accommodation: v.budgetAccommodation ?? null, food: v.budgetFood ?? null, activities: v.budgetActivities ?? null, transport: v.budgetTransport ?? null },
    pace: v.pace,
    interests: v.interests,
    foodPrefs: v.foodPrefs,
    dietaryNotes: v.dietaryNotes || null,
    transport: v.transport,
    morning: v.morning ?? "relaxed",
    dayLength: v.dayLength ?? "flexible",
    activityBalance: v.activityBalance ?? "balanced",
    walking: v.walking ?? "medium",
    accommodation: {
      status: v.accommodationStatus ?? "recommend",
      name: v.accommodationName || null,
      address: v.accommodationAddress || null,
      lat: v.accommodationLat ?? null,
      lng: v.accommodationLng ?? null,
      types: v.accommodationTypes ?? [],
    },
  };

  const tp = await getTranslations({ locale, namespace: "planner" });
  let tripId: string;
  try {
    tripId = await trips.createTrip({
      userId: user.id,
      mode,
      prefs,
      destinationId: dest.id,
      title: tp("defaultTitle", { city: dest.city }),
      locale,
      participants: (v.participants ?? []).filter((p) => p.name),
    });
  } catch (err) {
    if (err instanceof trips.NeedsPaymentError) {
      redirect({ href: { pathname: "/pricing", query: { reason: err.reason } }, locale });
    }
    console.error(err);
    return { ok: false, message: "genericError" };
  }
  revalidatePath(`/${locale}/trips`);
  redirect({ href: `/trips/${tripId}`, locale });
  return { ok: true };
}

/* ───── Itinerary editing. Each returns the fresh trip so the client can re-render. ───── */

async function withUser<T>(fn: (userId: string) => Promise<T>) {
  const user = await getCurrentUser();
  if (!user) throw new Error("unauthorized");
  if (!(await rateLimit("edit-trip", 240, 10 * 60_000, user.id))) throw new Error("rate_limited");
  return fn(user.id);
}

async function fresh(userId: string, tripId: string) {
  return trips.getTrip(tripId, userId);
}

export async function reorderStopsAction(tripId: string, dayId: string, orderedIds: string[]) {
  return withUser(async (uid) => {
    await trips.reorderStops(uid, tripId, dayId, orderedIds.slice(0, 50).map(String));
    return fresh(uid, tripId);
  });
}

export async function moveStopAction(tripId: string, stopId: string, toDayId: string) {
  return withUser(async (uid) => {
    await trips.moveStopToDay(uid, tripId, stopId, toDayId);
    return fresh(uid, tripId);
  });
}

export async function removeStopAction(tripId: string, stopId: string) {
  return withUser(async (uid) => {
    await trips.removeStop(uid, tripId, stopId);
    return fresh(uid, tripId);
  });
}

export async function toggleLockAction(tripId: string, stopId: string, locked: boolean) {
  return withUser(async (uid) => {
    await trips.setStopLocked(uid, tripId, stopId, Boolean(locked));
    return fresh(uid, tripId);
  });
}

export async function replaceStopAction(tripId: string, stopId: string) {
  return withUser(async (uid) => {
    const res = await trips.replaceStop(uid, tripId, stopId);
    return { trip: await fresh(uid, tripId), replaced: res.replaced };
  });
}

export async function updateStopAction(tripId: string, stopId: string, patch: { durationMin?: number; description?: string | null }) {
  const durationMin = patch.durationMin != null ? Math.min(600, Math.max(10, Math.round(Number(patch.durationMin)))) : undefined;
  const description = patch.description != null ? String(patch.description).slice(0, 500) : patch.description;
  return withUser(async (uid) => {
    await trips.updateStopDetails(uid, tripId, stopId, { durationMin, description });
    return fresh(uid, tripId);
  });
}

export async function addPlaceStopAction(tripId: string, dayId: string, placeId: string) {
  return withUser(async (uid) => {
    await trips.addStop(uid, tripId, dayId, { placeId });
    return fresh(uid, tripId);
  });
}

export async function addCustomStopAction(tripId: string, dayId: string, input: { title: string; lat: number | null; lng: number | null; durationMin: number }) {
  const title = String(input.title ?? "").trim().slice(0, 140);
  if (!title) throw new Error("invalid");
  const lat = input.lat != null && Number.isFinite(+input.lat) && Math.abs(+input.lat) <= 90 ? +input.lat : null;
  const lng = input.lng != null && Number.isFinite(+input.lng) && Math.abs(+input.lng) <= 180 ? +input.lng : null;
  const durationMin = Math.min(600, Math.max(10, Math.round(Number(input.durationMin) || 60)));
  return withUser(async (uid) => {
    await trips.addStop(uid, tripId, dayId, { custom: { title, lat, lng, durationMin } });
    return fresh(uid, tripId);
  });
}

export async function regenerateDayAction(tripId: string, dayId: string) {
  return withUser(async (uid) => {
    await trips.regenerateDay(uid, tripId, dayId);
    return fresh(uid, tripId);
  });
}

export async function regenerateTripAction(tripId: string) {
  const locale = await getLocale();
  return withUser(async (uid) => {
    await trips.regenerateTrip(uid, tripId, locale);
    return fresh(uid, tripId);
  });
}

export async function updateTripMetaAction(tripId: string, patch: { title?: string; status?: "draft" | "planned" | "completed" }) {
  const status = patch.status && ["draft", "planned", "completed"].includes(patch.status) ? patch.status : undefined;
  return withUser(async (uid) => {
    await trips.updateTripMeta(uid, tripId, { title: patch.title?.trim() || undefined, status });
    return fresh(uid, tripId);
  });
}

export async function duplicateTripAction(tripId: string) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "trips" });
  const newId = await withUser((uid) => trips.duplicateTrip(uid, tripId, t("copySuffix")));
  revalidatePath(`/${locale}/trips`);
  redirect({ href: `/trips/${newId}`, locale });
}

export async function deleteTripAction(tripId: string) {
  const locale = await getLocale();
  await withUser((uid) => trips.deleteTrip(uid, tripId));
  revalidatePath(`/${locale}/trips`);
  redirect({ href: "/trips", locale });
}

/* ───────────── Multi-city & accommodation ───────────── */

async function freshWithPlanning(userId: string, tripId: string, locale: string) {
  const trip = await trips.getTrip(tripId, userId);
  return { trip, planning: trip ? await trips.getTripPlanning(trip, locale) : null };
}

export async function acceptSplitAction(tripId: string, choice: trips.SplitChoice) {
  const locale = await getLocale();
  // Validate the shape strictly; the option itself is re-checked against the engine server-side.
  const safe: trips.SplitChoice =
    "optionId" in choice
      ? { optionId: String(choice.optionId).slice(0, 200) }
      : { slug: String(choice.slug).slice(0, 80), type: choice.type === "day_trip" ? "day_trip" : "stay" };
  return withUser(async (uid) => {
    await trips.acceptSplit(uid, tripId, safe, locale);
    return freshWithPlanning(uid, tripId, locale);
  });
}

export async function declineSplitAction(tripId: string) {
  const locale = await getLocale();
  return withUser(async (uid) => {
    await trips.declineSplit(uid, tripId);
    return freshWithPlanning(uid, tripId, locale);
  });
}

export async function resetSplitAction(tripId: string) {
  const locale = await getLocale();
  return withUser(async (uid) => {
    await trips.resetSplit(uid, tripId, locale);
    return freshWithPlanning(uid, tripId, locale);
  });
}

export async function setAccommodationAction(tripId: string, input: { status: "booked" | "recommend"; name?: string | null; address?: string | null; lat?: number | null; lng?: number | null }) {
  const locale = await getLocale();
  const status: "booked" | "recommend" = input.status === "booked" ? "booked" : "recommend";
  const name = String(input.name ?? "").trim().slice(0, 140) || null;
  const address = String(input.address ?? "").trim().slice(0, 240) || null;
  const lat = input.lat != null && Number.isFinite(+input.lat) && Math.abs(+input.lat) <= 90 ? +input.lat : null;
  const lng = input.lng != null && Number.isFinite(+input.lng) && Math.abs(+input.lng) <= 180 ? +input.lng : null;
  if (status === "booked" && !name) throw new Error("invalid");
  const acc = status === "booked" ? { status, name, address, lat: lat != null && lng != null ? lat : null, lng: lat != null && lng != null ? lng : null } : { status, name: null, address: null, lat: null, lng: null };
  return withUser(async (uid) => {
    await trips.setAccommodation(uid, tripId, acc, locale);
    return freshWithPlanning(uid, tripId, locale);
  });
}
