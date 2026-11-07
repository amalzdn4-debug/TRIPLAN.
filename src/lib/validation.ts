import { z } from "zod";
import { INTERESTS, FOOD_PREFS, TRAVEL_STYLES, BUDGET_CATEGORIES, TRANSPORT_PREFS } from "@/lib/itinerary/types";
import { MAX_TRIP_DAYS } from "@/config/site";

/**
 * All validation messages are translation keys under "errors.*" so they render in the
 * user's language on the client. The same schemas run on the server (authoritative).
 */
export const E = {
  required: "required",
  email: "email",
  passwordShort: "passwordShort",
  passwordMismatch: "passwordMismatch",
  tooLong: "tooLong",
  invalid: "invalid",
  dateOrder: "dateOrder",
  tripTooLong: "tripTooLong",
  terms: "terms",
  tooMany: "tooMany",
} as const;

const text = (max: number) => z.string().trim().max(max, E.tooLong);
const required = (max: number) => text(max).min(1, E.required);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, E.invalid);
const optionalNumber = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().finite().nonnegative(E.invalid).max(10_000_000, E.invalid).nullable());
const optionalCoord = (min: number, max: number) => z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(min).max(max).nullable());
const checkboxList = <T extends readonly [string, ...string[]]>(values: T) => z.array(z.enum(values)).default([]);

export const emailSchema = z.string().trim().toLowerCase().min(1, E.required).max(254, E.tooLong).email(E.email);
export const passwordSchema = z.string().min(10, E.passwordShort).max(200, E.tooLong);

export const signupSchema = z
  .object({
    name: required(80),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
    terms: z.literal("on", { errorMap: () => ({ message: E.terms }) }),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: E.passwordMismatch });

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, E.required).max(200) });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z
  .object({ token: z.string().min(10, E.invalid).max(200), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: E.passwordMismatch });

const dateRange = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object({ ...shape, startDate: isoDate, endDate: isoDate })
    .superRefine((v, ctx) => {
      const a = Date.parse(v.startDate + "T00:00:00Z");
      const b = Date.parse(v.endDate + "T00:00:00Z");
      if (b < a) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: E.dateOrder });
      else if ((b - a) / 86_400_000 + 1 > MAX_TRIP_DAYS) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: E.tripTooLong });
    });

const base = {
  destination: required(120),
  departureCity: text(120).optional().default(""),
  adults: z.coerce.number().int().min(1, E.invalid).max(20, E.invalid),
  children: z.coerce.number().int().min(0).max(20, E.invalid).default(0),
  budgetTotal: optionalNumber,
  currency: z.string().regex(/^[A-Z]{3}$/, E.invalid).default("EUR"),
  budgetCategory: z.enum(BUDGET_CATEGORIES).default("mid"),
  pace: z.enum(TRAVEL_STYLES).default("balanced"),
  interests: checkboxList(INTERESTS),
  foodPrefs: checkboxList(FOOD_PREFS),
  transport: z.enum(TRANSPORT_PREFS).default("public"),
};

/** "HH:MM" (24 h) or empty. */
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, E.invalid).or(z.literal("")).default("");

/** Arrival/departure end point and accommodation times, as edited in the trip workspace. */
export const travelEndSchema = z
  .object({
    mode: z.enum(["plane", "train", "bus", "car", "other"]),
    name: z.string().trim().max(160).nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
  })
  .nullable();

export const logisticsSchema = z.object({
  arrival: travelEndSchema,
  departure: travelEndSchema,
  arrivalTime: clockTime,
  departureTime: clockTime,
  checkInTime: clockTime,
  checkOutTime: clockTime,
});

export const fastTripSchema = dateRange(base);

export const detailedTripSchema = dateRange({
  ...base,
  departureTime: clockTime,
  returnTime: clockTime,
  companions: z.enum(["solo", "couple", "family", "friends", "business"]).default("couple"),
  budgetPerPerson: optionalNumber,
  budgetAccommodation: optionalNumber,
  budgetFood: optionalNumber,
  budgetActivities: optionalNumber,
  budgetTransport: optionalNumber,
  accommodationStatus: z.enum(["booked", "recommend", "compare"]).default("recommend"),
  accommodationName: text(160).optional().default(""),
  accommodationAddress: text(240).optional().default(""),
  accommodationLat: optionalCoord(-90, 90),
  accommodationLng: optionalCoord(-180, 180),
  accommodationTypes: z.array(z.enum(["hotel", "apartment", "hostel", "guesthouse", "resort"])).default([]),
  dietaryNotes: text(300).optional().default(""),
  morning: z.enum(["early", "relaxed"]).default("relaxed"),
  dayLength: z.enum(["full", "flexible"]).default("flexible"),
  activityBalance: z.enum(["more_activities", "balanced", "more_free_time"]).default("balanced"),
  walking: z.enum(["low", "medium", "high"]).default("medium"),
  // Arrival / departure (airport or station from the address search) and accommodation times.
  arrivalMode: z.enum(["plane", "train", "bus", "car", "other"]).default("plane"),
  arrivalPlace: text(160).optional().default(""),
  arrivalLat: optionalCoord(-90, 90),
  arrivalLng: optionalCoord(-180, 180),
  departureMode: z.enum(["same", "plane", "train", "bus", "car", "other"]).default("same"),
  departurePlace: text(160).optional().default(""),
  departureLat: optionalCoord(-90, 90),
  departureLng: optionalCoord(-180, 180),
  checkInTime: clockTime,
  checkOutTime: clockTime,
  participants: z.array(z.object({ name: text(80), isChild: z.boolean().default(false) })).max(20).default([]),
});

export const contactSchema = z.object({
  name: required(100),
  email: emailSchema,
  topic: z.enum(["general", "account", "billing", "partnership", "press", "privacy"]),
  message: required(5000).pipe(z.string().min(10, E.required)),
  website: z.string().max(0).optional(), // honeypot
});

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, E.invalid);

export const postSchema = z.object({
  destinationSlug: required(80),
  type: z.enum(["recommendation", "hidden_gem", "review", "restaurant", "tip"]),
  title: required(140),
  body: required(4000).pipe(z.string().min(20, E.required)),
  rating: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(5).nullable()),
  /** Optional location within the destination. */
  placeName: text(140).optional().default(""),
  lat: optionalCoord(-90, 90).optional().default(null),
  lng: optionalCoord(-180, 180).optional().default(null),
  /** Uploaded photos in display order, as JSON: [{ id, alt }]. Ownership is checked on the server. */
  photos: z.preprocess(
    (v) => {
      if (typeof v !== "string" || !v) return [];
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    },
    z.array(z.object({ id: uuid, alt: text(200).optional().default("") })).max(6, E.tooMany).default([]),
  ),
});

export const commentSchema = z.object({
  body: required(2000),
});

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, E.required).max(5),
  body: required(2000).pipe(z.string().min(10, E.required)),
});

export const profileSchema = z.object({
  displayName: required(80),
  homeCity: text(120).optional().default(""),
  bio: text(500).optional().default(""),
});

export const preferencesSchema = z.object({
  locale: z.enum(["en", "ar", "fr", "es", "it", "zh", "ru", "pt"]),
  currency: z.string().regex(/^[A-Z]{3}$/, E.invalid),
  units: z.enum(["metric", "imperial"]),
  timeFormat: z.enum(["auto", "12h", "24h"]),
  marketingEmails: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export type FieldErrors = Record<string, string>;

export function flattenErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = Object.values(E).includes(issue.message as never) ? issue.message : E.invalid;
  }
  return out;
}

/** Reads a FormData into a plain object, collecting repeated keys (checkbox groups) into arrays. */
export function formToObject(fd: FormData, arrayKeys: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const all = fd.getAll(key).map((v) => (typeof v === "string" ? v : ""));
    out[key] = arrayKeys.includes(key) ? all : all[0];
  }
  for (const k of arrayKeys) out[k] ??= [];
  return out;
}

export interface ActionState {
  ok: boolean;
  errors?: FieldErrors;
  message?: string; // translation key under "status.*"
  values?: Record<string, unknown>;
}
