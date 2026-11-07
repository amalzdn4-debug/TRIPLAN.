import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  doublePrecision,
  numeric,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  char,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ───────────── Users, auth, profiles ───────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    googleSub: text("google_sub"),
    stripeCustomerId: text("stripe_customer_id"),
    tripsCreatedTotal: integer("trips_created_total").notNull().default(0),
    tripCredits: integer("trip_credits").notNull().default(0),
    status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`),
    uniqueIndex("users_google_sub_idx").on(t.googleSub),
    uniqueIndex("users_stripe_customer_idx").on(t.stripeCustomerId),
  ],
);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull().default(""),
  homeCity: text("home_city"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  updatedAt: updatedAt(),
});

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  locale: text("locale").notNull().default("en"),
  currency: char("currency", { length: 3 }).notNull().default("EUR"),
  units: text("units", { enum: ["metric", "imperial"] }).notNull().default("metric"),
  timeFormat: text("time_format", { enum: ["auto", "12h", "24h"] }).notNull().default("auto"),
  marketingEmails: boolean("marketing_emails").notNull().default(false),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256(token) — the raw token only lives in the cookie
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["verify_email", "reset_password"] }).notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("auth_tokens_hash_idx").on(t.tokenHash)],
);

/* ───────────── Languages & translations ───────────── */

export const languages = pgTable("languages", {
  code: text("code").primaryKey(),
  nativeName: text("native_name").notNull(),
  dir: text("dir", { enum: ["ltr", "rtl"] }).notNull().default("ltr"),
  enabled: boolean("enabled").notNull().default(true),
});

/** Admin-editable overrides on top of the JSON dictionaries in /messages. */
export const translationRecords = pgTable(
  "translation_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locale: text("locale").notNull().references(() => languages.code),
    key: text("key").notNull(), // dot path, e.g. "home.hero.title"
    value: text("value").notNull(),
    reviewed: boolean("reviewed").notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("translation_records_locale_key_idx").on(t.locale, t.key)],
);

/* ───────────── Geography & destinations ───────────── */

export const countries = pgTable("countries", {
  code: char("code", { length: 2 }).primaryKey(), // ISO 3166-1 alpha-2; names via Intl.DisplayNames
  continent: text("continent", {
    enum: ["europe", "mena", "asia", "north_america", "south_america", "africa", "oceania"],
  }).notNull(),
  currency: char("currency", { length: 3 }),
});

export const cities = pgTable(
  "cities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    countryCode: char("country_code", { length: 2 }).notNull().references(() => countries.code),
    name: text("name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    timezone: text("timezone"),
  },
  (t) => [index("cities_country_idx").on(t.countryCode)],
);

export const destinations = pgTable(
  "destinations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    cityId: uuid("city_id").notNull().references(() => cities.id, { onDelete: "restrict" }),
    summary: text("summary").notNull(),
    description: text("description").notNull().default(""),
    bestTime: text("best_time"),
    suggestedDaysMin: integer("suggested_days_min"),
    suggestedDaysMax: integer("suggested_days_max"),
    budgetLevel: text("budget_level", { enum: ["budget", "mid", "premium"] }),
    climate: text("climate", { enum: ["temperate", "mediterranean", "tropical", "desert", "continental", "subtropical", "oceanic", "alpine", "subarctic"] }),
    travelStyles: text("travel_styles").array().notNull().default(sql`'{}'::text[]`),
    experiences: text("experiences").array().notNull().default(sql`'{}'::text[]`),
    bestMonths: integer("best_months").array().notNull().default(sql`'{}'::int[]`),
    neighborhoods: jsonb("neighborhoods").$type<{ name: string; note?: string }[]>().notNull().default([]),
    popularity: integer("popularity").notNull().default(50),
    featured: boolean("featured").notNull().default(false),
    published: boolean("published").notNull().default(true),
    /** "sample" = seeded editorial content awaiting verification; "verified" = checked by an editor. */
    contentStatus: text("content_status", { enum: ["sample", "verified"] }).notNull().default("sample"),
    /** Per-language text; `name` is the city's name in that language (from Wikipedia titles or an editor). */
    translations: jsonb("translations").$type<Record<string, { summary?: string; description?: string; bestTime?: string; name?: string }>>().notNull().default({}),
    kind: text("kind", { enum: ["city", "coastal", "island", "nature"] }).notNull().default("city"),
    /** Wikipedia import (0003): article title, its URL and plain-text introduction. */
    wikiTitle: text("wiki_title"),
    wikipediaUrl: text("wikipedia_url"),
    wikiExtract: text("wiki_extract"),
    enrichmentStatus: text("enrichment_status", { enum: ["pending", "done", "partial", "failed", "skipped"] }).notNull().default("pending"),
    enrichmentError: text("enrichment_error"),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("destinations_slug_idx").on(t.slug), index("destinations_city_idx").on(t.cityId)],
);

export const destinationImages = pgTable(
  "destination_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    destinationId: uuid("destination_id").notNull().references(() => destinations.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull(),
    creditName: text("credit_name"),
    creditUrl: text("credit_url"),
    license: text("license").notNull().default("Unsplash License"),
    sortOrder: integer("sort_order").notNull().default(0),
    source: text("source", { enum: ["unsplash", "wikimedia", "upload"] }).notNull().default("unsplash"),
    licenseUrl: text("license_url"),
    filePageUrl: text("file_page_url"),
    width: integer("width"),
    height: integer("height"),
    heroEligible: boolean("hero_eligible").notNull().default(false),
  },
  (t) => [index("destination_images_dest_idx").on(t.destinationId)],
);

/**
 * Places: attractions, restaurants, accommodation, activities, luggage storage
 * and transport hubs share one table, distinguished by `kind`.
 * Kind-specific attributes live in typed columns where they are queried and in `details` otherwise.
 */
export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    destinationId: uuid("destination_id").notNull().references(() => destinations.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["attraction", "restaurant", "accommodation", "activity", "luggage_storage", "transport_hub"],
    }).notNull(),
    name: text("name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    address: text("address"),
    neighborhood: text("neighborhood"),
    description: text("description"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    durationMin: integer("duration_min"),
    priceLevel: integer("price_level"), // 1–4, only when known
    cuisine: text("cuisine"),
    /** Dietary tags are only displayed when verification = "verified". */
    dietaryTags: text("dietary_tags").array().notNull().default(sql`'{}'::text[]`),
    openingHours: jsonb("opening_hours"),
    websiteUrl: text("website_url"),
    bookingUrl: text("booking_url"),
    verification: text("verification", { enum: ["sample", "verified", "community"] }).notNull().default("sample"),
    source: text("source"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    wikidataId: text("wikidata_id"),
    imageUrl: text("image_url"),
    imageCredit: text("image_credit"),
    imageLicense: text("image_license"),
    popularity: integer("popularity").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("places_dest_kind_idx").on(t.destinationId, t.kind)],
);

/** Curated intercity connections with typical journey times (0003). Never live timetables. */
export const destinationConnections = pgTable(
  "destination_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromDestinationId: uuid("from_destination_id").notNull().references(() => destinations.id, { onDelete: "cascade" }),
    toDestinationId: uuid("to_destination_id").notNull().references(() => destinations.id, { onDelete: "cascade" }),
    mode: text("mode", { enum: ["train", "bus", "ferry", "flight", "car"] }).notNull(),
    typicalMinutes: integer("typical_minutes").notNull(),
    direct: boolean("direct").notNull().default(true),
    note: text("note"),
    source: text("source", { enum: ["curated", "admin"] }).notNull().default("curated"),
    verified: boolean("verified").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("destination_connections_pair_uq").on(t.fromDestinationId, t.toDestinationId, t.mode), index("destination_connections_to_idx").on(t.toDestinationId)],
);

export const transportOptions = pgTable("transport_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  destinationId: uuid("destination_id").notNull().references(() => destinations.id, { onDelete: "cascade" }),
  mode: text("mode", { enum: ["metro", "bus", "train", "tram", "taxi", "airport_transfer", "car_rental", "bike", "ferry", "walking"] }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  url: text("url"),
  verification: text("verification", { enum: ["sample", "verified"] }).notNull().default("sample"),
});

/* ───────────── Trips & itineraries ───────────── */

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    mode: text("mode", { enum: ["fast", "detailed"] }).notNull(),
    status: text("status", { enum: ["draft", "planned", "completed"] }).notNull().default("draft"),
    destinationId: uuid("destination_id").references(() => destinations.id, { onDelete: "set null" }),
    destinationName: text("destination_name").notNull(),
    departureCity: text("departure_city"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    adults: integer("adults").notNull().default(1),
    children: integer("children").notNull().default(0),
    budgetTotal: numeric("budget_total", { precision: 12, scale: 2 }),
    currency: char("currency", { length: 3 }).notNull().default("EUR"),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull().default({}),
    generationSource: text("generation_source", { enum: ["rules", "ai"] }),
    entitlement: text("entitlement", { enum: ["free", "credit", "subscription", "admin"] }).notNull().default("free"),
    /** The subscription that paid for this trip, if any (for per-period counting). */
    subscriptionId: uuid("subscription_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("trips_user_idx").on(t.userId, t.updatedAt)],
);

export const tripParticipants = pgTable("trip_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  relation: text("relation"),
  isChild: boolean("is_child").notNull().default(false),
});

export const itineraryDays = pgTable(
  "itinerary_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    dayIndex: integer("day_index").notNull(),
    date: date("date"),
    title: text("title").notNull(),
    startTime: text("start_time").notNull().default("09:00"),
    notes: text("notes"),
    /** Multi-city trips: where this day is spent (null = the trip's main destination). */
    destinationId: uuid("destination_id").references(() => destinations.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["normal", "travel", "day_trip"] }).notNull().default("normal"),
  },
  (t) => [uniqueIndex("itinerary_days_trip_day_idx").on(t.tripId, t.dayIndex), index("itinerary_days_destination_idx").on(t.destinationId)],
);

export const itineraryStops = pgTable(
  "itinerary_stops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    dayId: uuid("day_id").notNull().references(() => itineraryDays.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: text("kind", { enum: ["attraction", "meal", "activity", "break", "accommodation", "transport", "custom"] }).notNull(),
    mealType: text("meal_type", { enum: ["breakfast", "lunch", "snack", "dinner", "drinks"] }),
    title: text("title").notNull(),
    description: text("description"),
    placeId: uuid("place_id").references(() => places.id, { onDelete: "set null" }),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    address: text("address"),
    startTime: text("start_time"), // "HH:MM" local time at destination
    durationMin: integer("duration_min").notNull().default(60),
    costMin: numeric("cost_min", { precision: 10, scale: 2 }),
    costMax: numeric("cost_max", { precision: 10, scale: 2 }),
    costCurrency: char("cost_currency", { length: 3 }),
    costBasis: text("cost_basis", { enum: ["per_person", "total"] }),
    costStatus: text("cost_status", { enum: ["estimated", "confirmed"] }),
    linkUrl: text("link_url"),
    linkLabel: text("link_label"),
    locked: boolean("locked").notNull().default(false),
    travelMode: text("travel_mode", { enum: ["walking", "transit", "driving", "cycling"] }),
    travelMinutes: integer("travel_minutes"),
    travelMeters: integer("travel_meters"),
    travelSource: text("travel_source", { enum: ["provider", "estimate"] }),
    details: jsonb("details").$type<import("@/lib/itinerary/types").StopDetails | null>(),
  },
  (t) => [index("itinerary_stops_day_pos_idx").on(t.dayId, t.position), index("itinerary_stops_trip_idx").on(t.tripId)],
);

export const savedItems = pgTable(
  "saved_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    destinationId: uuid("destination_id").references(() => destinations.id, { onDelete: "cascade" }),
    placeId: uuid("place_id").references(() => places.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("saved_items_user_dest_idx").on(t.userId, t.destinationId),
    uniqueIndex("saved_items_user_place_idx").on(t.userId, t.placeId),
  ],
);

/* ───────────── Community ───────────── */

export const communityPosts = pgTable(
  "community_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    destinationId: uuid("destination_id").notNull().references(() => destinations.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["recommendation", "hidden_gem", "review", "restaurant", "tip"] }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    rating: integer("rating"),
    locale: text("locale").notNull().default("en"),
    status: text("status", { enum: ["published", "pending", "hidden", "removed"] }).notNull().default("published"),
    likeCount: integer("like_count").notNull().default(0),
    reportCount: integer("report_count").notNull().default(0),
    photoUrl: text("photo_url"),
    /** Optional, user-entered location within the destination (name and/or map pin). */
    placeName: text("place_name"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    commentCount: integer("comment_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("community_posts_dest_idx").on(t.destinationId, t.status, t.createdAt),
    index("community_posts_status_idx").on(t.status),
    index("community_posts_user_idx").on(t.userId, t.createdAt),
  ],
);

/** Uploaded images (Vercel Blob): pending until attached to a post. */
export const mediaUploads = pgTable(
  "media_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id").references(() => communityPosts.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["post_photo", "avatar"] }).notNull().default("post_photo"),
    url: text("url").notNull().unique(),
    pathname: text("pathname").notNull(),
    contentType: text("content_type", { enum: ["image/jpeg", "image/webp"] }).notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    position: integer("position").notNull().default(0),
    alt: text("alt"),
    status: text("status", { enum: ["pending", "attached"] }).notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [index("media_uploads_post_idx").on(t.postId, t.position), index("media_uploads_user_status_idx").on(t.userId, t.status, t.createdAt)],
);

export const postComments = pgTable(
  "post_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    status: text("status", { enum: ["published", "hidden", "removed"] }).notNull().default("published"),
    reportCount: integer("report_count").notNull().default(0),
    createdAt: createdAt(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (t) => [index("post_comments_post_idx").on(t.postId, t.createdAt), index("post_comments_status_idx").on(t.status)],
);

export const postLikes = pgTable(
  "post_likes",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] })],
);

export const postSaves = pgTable(
  "post_saves",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] })],
);

/** Platform reviews ("Reviews & Opinions" page) written by signed-in users. */
export const platformReviews = pgTable("platform_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  body: text("body").notNull(),
  locale: text("locale").notNull().default("en"),
  status: text("status", { enum: ["published", "pending", "hidden"] }).notNull().default("pending"),
  createdAt: createdAt(),
});

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id").references(() => communityPosts.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id").references(() => postComments.id, { onDelete: "cascade" }),
    reason: text("reason", { enum: ["spam", "offensive", "misleading", "unsafe", "other"] }).notNull(),
    details: text("details"),
    status: text("status", { enum: ["open", "resolved", "dismissed"] }).notNull().default("open"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("reports_reporter_post_idx").on(t.reporterId, t.postId), index("reports_status_idx").on(t.status)],
);

/* ───────────── Billing ───────────── */

export const subscriptionPlans = pgTable("subscription_plans", {
  id: text("id").primaryKey(), // "free" | "trip_pack" | "annual"
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  currency: char("currency", { length: 3 }).notNull().default("EUR"),
  billing: text("billing", { enum: ["free", "one_time", "monthly", "yearly"] }).notNull(),
  tripsIncluded: integer("trips_included"), // null = unlimited (fair use)
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: updatedAt(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull().references(() => subscriptionPlans.id),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    status: text("status").notNull(), // mirrors Stripe: active, trialing, past_due, canceled, unpaid, incomplete…
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    /** Trips created in the current billing period (reset when Stripe reports a new period). */
    tripsUsedInPeriod: integer("trips_used_in_period").notNull().default(0),
    /** false = Stripe test mode. Test subscriptions/payments are never counted as real. */
    livemode: boolean("livemode").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("subscriptions_stripe_idx").on(t.stripeSubscriptionId), index("subscriptions_user_idx").on(t.userId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull().references(() => subscriptionPlans.id),
    stripeSessionId: text("stripe_session_id"),
    stripeInvoiceId: text("stripe_invoice_id"),
    amountCents: integer("amount_cents").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    status: text("status", { enum: ["paid", "failed", "refunded"] }).notNull(),
    livemode: boolean("livemode").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("payments_session_idx").on(t.stripeSessionId),
    uniqueIndex("payments_invoice_idx").on(t.stripeInvoiceId),
    index("payments_user_idx").on(t.userId),
  ],
);

/* ───────────── Affiliates ───────────── */

export const AFFILIATE_CATEGORIES = ["accommodation", "flights", "activities", "transport", "car_rental", "luggage", "insurance", "esim", "other"] as const;

export const affiliatePartners = pgTable(
  "affiliate_partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: text("category", { enum: AFFILIATE_CATEGORIES }).notNull(),
    /** Only "approved" partners are shown to visitors. */
    status: text("status", { enum: ["pending", "approved", "paused", "rejected"] }).notNull().default("pending"),
    linkTemplate: text("link_template").notNull(),
    websiteUrl: text("website_url"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("affiliate_partners_status_idx").on(t.status, t.category, t.sortOrder)],
);

export const affiliateClicks = pgTable(
  "affiliate_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id").notNull().references(() => affiliatePartners.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    visitorHash: text("visitor_hash"),
    source: text("source"),
    destinationSlug: text("destination_slug"),
    locale: text("locale"),
    createdAt: createdAt(),
  },
  (t) => [index("affiliate_clicks_partner_idx").on(t.partnerId, t.createdAt)],
);

/** Processed Stripe event ids, for webhook idempotency. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  createdAt: createdAt(),
});

/* ───────────── Content & ops ───────────── */

export const heroSlides = pgTable("hero_slides", {
  id: uuid("id").primaryKey().defaultRandom(),
  imageUrl: text("image_url").notNull(),
  alt: text("alt").notNull(),
  city: text("city").notNull(),
  countryCode: char("country_code", { length: 2 }).notNull(),
  destinationSlug: text("destination_slug"),
  creditName: text("credit_name"),
  creditUrl: text("credit_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: createdAt(),
});

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  locale: text("locale").notNull(),
  handled: boolean("handled").notNull().default(false),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type ItineraryDay = typeof itineraryDays.$inferSelect;
export type ItineraryStop = typeof itineraryStops.$inferSelect;
export type Place = typeof places.$inferSelect;
export type Destination = typeof destinations.$inferSelect;
export type HeroSlide = typeof heroSlides.$inferSelect;
export type CommunityPost = typeof communityPosts.$inferSelect;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
