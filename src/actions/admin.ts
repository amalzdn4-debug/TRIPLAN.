"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { and, asc, eq, sql, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { formToObject, flattenErrors, type ActionState } from "@/lib/validation";
import { LOCALES } from "@/config/locales";
import { checkTemplate } from "@/lib/affiliate-template";

async function admin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new Error("forbidden");
  return user;
}

const url = z.string().trim().url().max(1000).refine((u) => u.startsWith("https://"), "https");
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);

/* ───────────── Hero slides ───────────── */

const heroSchema = z.object({
  imageUrl: url,
  alt: z.string().trim().min(3).max(200),
  city: z.string().trim().min(1).max(80),
  countryCode: z.string().trim().toUpperCase().length(2),
  destinationSlug: z.string().trim().max(80).optional().default(""),
  creditName: z.string().trim().max(120).optional().default(""),
  creditUrl: z.string().trim().max(500).optional().default(""),
});

export async function saveHeroSlideAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await admin();
  const raw = formToObject(fd);
  const parsed = heroSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values: raw };
  const db = await getDb();
  const v = { ...parsed.data, destinationSlug: parsed.data.destinationSlug || null, creditName: parsed.data.creditName || null, creditUrl: parsed.data.creditUrl || null };
  const id = typeof raw.id === "string" && raw.id ? raw.id : null;
  if (id) await db.update(schema.heroSlides).set(v).where(eq(schema.heroSlides.id, id));
  else {
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${schema.heroSlides.sortOrder}), -1)::int` }).from(schema.heroSlides);
    await db.insert(schema.heroSlides).values({ ...v, sortOrder: Number(max) + 1 });
  }
  revalidateTag("hero");
  revalidatePath("/[locale]/admin/hero", "page");
  return { ok: true, message: "saved" };
}

export async function heroSlideCommandAction(id: string, command: "up" | "down" | "toggle" | "delete") {
  await admin();
  const db = await getDb();
  if (command === "delete") await db.delete(schema.heroSlides).where(eq(schema.heroSlides.id, id));
  else if (command === "toggle") await db.update(schema.heroSlides).set({ enabled: sql`not ${schema.heroSlides.enabled}` }).where(eq(schema.heroSlides.id, id));
  else {
    const all = await db.select({ id: schema.heroSlides.id }).from(schema.heroSlides).orderBy(asc(schema.heroSlides.sortOrder));
    const i = all.findIndex((s) => s.id === id);
    const j = command === "up" ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < all.length) {
      [all[i], all[j]] = [all[j], all[i]];
      for (let k = 0; k < all.length; k++) await db.update(schema.heroSlides).set({ sortOrder: k }).where(eq(schema.heroSlides.id, all[k].id));
    }
  }
  revalidateTag("hero");
  revalidatePath("/[locale]/admin/hero", "page");
}

/* ───────────── Destinations & places ───────────── */

const destinationSchema = z.object({
  id: z.string().optional().default(""),
  slug,
  city: z.string().trim().min(1).max(80),
  countryCode: z.string().trim().toUpperCase().length(2),
  continent: z.enum(["europe", "mena", "asia", "north_america", "south_america", "africa", "oceania"]),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  summary: z.string().trim().min(10).max(300),
  description: z.string().trim().max(5000).optional().default(""),
  bestTime: z.string().trim().max(200).optional().default(""),
  daysMin: z.coerce.number().int().min(1).max(30),
  daysMax: z.coerce.number().int().min(1).max(60),
  budgetLevel: z.enum(["budget", "mid", "premium"]),
  contentStatus: z.enum(["sample", "verified"]),
  featured: z.preprocess((v) => v === "on", z.boolean()),
  published: z.preprocess((v) => v === "on", z.boolean()),
  imageUrl: z.union([url, z.literal("")]).optional().default(""),
  imageAlt: z.string().trim().max(200).optional().default(""),
  imageCredit: z.string().trim().max(120).optional().default(""),
  kind: z.enum(["city", "coastal", "island", "nature"]).optional().default("city"),
  wikiTitle: z.string().trim().max(200).optional().default(""),
});

export async function saveDestinationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await admin();
  const raw = formToObject(fd);
  const parsed = destinationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values: raw };
  const v = parsed.data;
  const db = await getDb();
  await db.insert(schema.countries).values({ code: v.countryCode, continent: v.continent }).onConflictDoNothing();
  let [city] = await db.select({ id: schema.cities.id }).from(schema.cities).where(and(eq(schema.cities.countryCode, v.countryCode), eq(schema.cities.name, v.city)));
  if (!city) [city] = await db.insert(schema.cities).values({ countryCode: v.countryCode, name: v.city, lat: v.lat, lng: v.lng }).returning({ id: schema.cities.id });
  else await db.update(schema.cities).set({ lat: v.lat, lng: v.lng }).where(eq(schema.cities.id, city.id));
  const values = {
    slug: v.slug,
    cityId: city.id,
    summary: v.summary,
    description: v.description,
    bestTime: v.bestTime || null,
    suggestedDaysMin: v.daysMin,
    suggestedDaysMax: Math.max(v.daysMin, v.daysMax),
    budgetLevel: v.budgetLevel,
    contentStatus: v.contentStatus,
    featured: v.featured,
    published: v.published,
    kind: v.kind,
    wikiTitle: v.wikiTitle || null,
    updatedAt: new Date(),
  };
  let destId = v.id;
  // A new or corrected Wikipedia title queues the destination for a fresh content import.
  if (destId) {
    const [old] = await db.select({ wikiTitle: schema.destinations.wikiTitle }).from(schema.destinations).where(eq(schema.destinations.id, destId));
    if (old && (old.wikiTitle ?? "") !== (v.wikiTitle || "")) Object.assign(values, { enrichmentStatus: "pending" as const, enrichmentError: null });
  }
  if (destId) await db.update(schema.destinations).set(values).where(eq(schema.destinations.id, destId));
  else [{ id: destId }] = await db.insert(schema.destinations).values(values).returning({ id: schema.destinations.id });
  if (v.imageUrl) {
    const has = await db.select({ id: schema.destinationImages.id }).from(schema.destinationImages).where(and(eq(schema.destinationImages.destinationId, destId), eq(schema.destinationImages.url, v.imageUrl)));
    if (!has.length) await db.insert(schema.destinationImages).values({ destinationId: destId, url: v.imageUrl, alt: v.imageAlt || v.city, creditName: v.imageCredit || null, sortOrder: -1 });
  }
  revalidateTag("destinations");
  return { ok: true, message: "saved" };
}

const placeSchema = z.object({
  destinationId: z.string().uuid(),
  kind: z.enum(["attraction", "restaurant", "accommodation", "activity", "luggage_storage", "transport_hub"]),
  name: z.string().trim().min(2).max(140),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  neighborhood: z.string().trim().max(80).optional().default(""),
  address: z.string().trim().max(240).optional().default(""),
  tags: z.string().trim().max(300).optional().default(""),
  durationMin: z.coerce.number().int().min(10).max(600).optional(),
  cuisine: z.string().trim().max(80).optional().default(""),
  dietaryTags: z.string().trim().max(200).optional().default(""),
  websiteUrl: z.union([url, z.literal("")]).optional().default(""),
  bookingUrl: z.union([url, z.literal("")]).optional().default(""),
  verification: z.enum(["sample", "verified"]),
  source: z.string().trim().max(200).optional().default(""),
});

export async function savePlaceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await admin();
  const raw = formToObject(fd);
  const parsed = placeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values: raw };
  const v = parsed.data;
  const list = (s: string) => s.split(",").map((x) => x.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean).slice(0, 20);
  const db = await getDb();
  await db.insert(schema.places).values({
    destinationId: v.destinationId,
    kind: v.kind,
    name: v.name,
    lat: v.lat,
    lng: v.lng,
    neighborhood: v.neighborhood || null,
    address: v.address || null,
    tags: list(v.tags),
    durationMin: v.durationMin ?? null,
    cuisine: v.cuisine || null,
    dietaryTags: list(v.dietaryTags),
    websiteUrl: v.websiteUrl || null,
    bookingUrl: v.bookingUrl || null,
    verification: v.verification,
    source: v.source || "admin",
  });
  revalidateTag("destinations");
  revalidatePath("/[locale]/admin/destinations/[id]", "page");
  return { ok: true, message: "saved" };
}

export async function placeCommandAction(id: string, command: "verify" | "unverify" | "delete") {
  await admin();
  const db = await getDb();
  if (command === "delete") await db.delete(schema.places).where(eq(schema.places.id, id));
  else await db.update(schema.places).set({ verification: command === "verify" ? "verified" : "sample", updatedAt: new Date() }).where(eq(schema.places.id, id));
  revalidateTag("destinations");
  revalidatePath("/[locale]/admin/destinations/[id]", "page");
}

/* ───────────── Content import (Wikipedia / Wikimedia / Wikidata) ───────────── */

export interface EnrichResult {
  ok: boolean;
  processed: number;
  done: number;
  partial: number;
  failed: number;
  remaining: number;
  errors: { slug: string; error: string }[];
  message?: string;
}

/** Imports content for the next pending destinations (or the given one), within ~40 s. */
export async function enrichContentAction(slug?: string): Promise<EnrichResult> {
  await admin();
  const { connectRaw } = await import("@/db/raw");
  const { enrichBatch } = await import("@/lib/enrich/run");
  const db = await connectRaw();
  try {
    const s = await enrichBatch(db, { budgetMs: 40_000, slugs: slug ? [slug] : undefined });
    revalidateTag("destinations");
    revalidatePath("/[locale]/admin/destinations", "page");
    return { ok: true, ...s };
  } catch (e) {
    return { ok: false, processed: 0, done: 0, partial: 0, failed: 0, remaining: 0, errors: [], message: (e as Error).message };
  } finally {
    await db.close();
  }
}

/* ───────────── Moderation ───────────── */

export async function moderatePostAction(postId: string, status: "published" | "hidden" | "removed") {
  const user = await admin();
  const db = await getDb();
  await db.update(schema.communityPosts).set({ status, updatedAt: new Date() }).where(eq(schema.communityPosts.id, postId));
  await db.update(schema.reports).set({ status: status === "published" ? "dismissed" : "resolved", resolvedBy: user.id }).where(and(eq(schema.reports.postId, postId), eq(schema.reports.status, "open")));
  revalidatePath("/[locale]/admin/moderation", "page");
  revalidatePath("/[locale]/community", "page");
}

export async function moderateCommentAction(commentId: string, status: "published" | "hidden" | "removed") {
  const user = await admin();
  const db = await getDb();
  const [c] = await db.update(schema.postComments).set({ status }).where(eq(schema.postComments.id, commentId)).returning({ postId: schema.postComments.postId });
  await db.update(schema.reports).set({ status: status === "published" ? "dismissed" : "resolved", resolvedBy: user.id }).where(and(eq(schema.reports.commentId, commentId), eq(schema.reports.status, "open")));
  if (c) {
    await db
      .update(schema.communityPosts)
      .set({ commentCount: sql`(select count(*)::int from post_comments x where x.post_id = ${c.postId} and x.status = 'published')` })
      .where(eq(schema.communityPosts.id, c.postId));
  }
  revalidatePath("/[locale]/admin/moderation", "page");
}

export async function moderateReviewAction(reviewId: string, status: "published" | "hidden") {
  await admin();
  const db = await getDb();
  await db.update(schema.platformReviews).set({ status }).where(eq(schema.platformReviews.id, reviewId));
  revalidatePath("/[locale]/admin/moderation", "page");
  revalidatePath("/[locale]/reviews", "page");
}

/* ───────────── Users ───────────── */

export async function userCommandAction(userId: string, command: "make_admin" | "make_user" | "suspend" | "activate" | "verify_email") {
  const me = await admin();
  if (command === "verify_email") {
    // Manual verification while email sending isn't set up (also allowed for your own account).
    const db = await getDb();
    await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(and(eq(schema.users.id, userId), isNull(schema.users.emailVerifiedAt)));
    revalidatePath("/[locale]/admin/users", "page");
    return;
  }
  if (userId === me.id) return; // admins can't demote or suspend themselves
  const db = await getDb();
  if (command === "make_admin" || command === "make_user") await db.update(schema.users).set({ role: command === "make_admin" ? "admin" : "user" }).where(eq(schema.users.id, userId));
  else {
    await db.update(schema.users).set({ status: command === "suspend" ? "suspended" : "active" }).where(eq(schema.users.id, userId));
    if (command === "suspend") await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  }
  revalidatePath("/[locale]/admin/users", "page");
}

/* ───────────── Pricing ───────────── */

export async function savePlanAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await admin();
  const parsed = z
    .object({
      id: z.enum(["free", "trip_pack", "monthly", "annual"]),
      name: z.string().trim().min(1).max(60),
      price: z.coerce.number().min(0).max(10000),
      currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
      active: z.preprocess((v) => v === "on", z.boolean()),
      // Only the Monthly plan has a configurable number of trips per billing month.
      tripsIncluded: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(100).nullable()).optional(),
    })
    .safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
  const v = parsed.data;
  const db = await getDb();
  await db
    .update(schema.subscriptionPlans)
    .set({
      name: v.name,
      priceCents: Math.round(v.price * 100),
      currency: v.currency,
      active: v.id === "free" ? true : v.active,
      ...(v.id === "monthly" && v.tripsIncluded ? { tripsIncluded: v.tripsIncluded } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.subscriptionPlans.id, v.id));
  revalidatePath("/[locale]/pricing", "page");
  return { ok: true, message: "saved" };
}

/* ───────────── Affiliates ───────────── */

const affiliateSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,40}$/),
  category: z.enum(schema.AFFILIATE_CATEGORIES),
  linkTemplate: z.string().trim().max(1000).superRefine((v, ctx) => {
    const problem = checkTemplate(v);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  }),
  websiteUrl: z.union([url, z.literal("")]).optional(),
  notes: z.string().trim().max(1000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

/** Adds or edits a partner. New partners start as "pending" and are never shown until approved. */
export async function saveAffiliateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await admin();
  const raw = formToObject(fd);
  // Say exactly what's wrong with a tracking link (https only, placeholders after the host…).
  const templateProblem = checkTemplate(String(raw.linkTemplate ?? ""));
  if (templateProblem) return { ok: false, errors: { linkTemplate: templateProblem }, values: raw };
  const parsed = affiliateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values: raw };
  const v = parsed.data;
  const db = await getDb();
  const values = { name: v.name, slug: v.slug, category: v.category, linkTemplate: v.linkTemplate, websiteUrl: v.websiteUrl || null, notes: v.notes || null, sortOrder: v.sortOrder, updatedAt: new Date() };
  try {
    if (v.id) await db.update(schema.affiliatePartners).set(values).where(eq(schema.affiliatePartners.id, v.id));
    else await db.insert(schema.affiliatePartners).values({ ...values, status: "pending" });
  } catch {
    return { ok: false, errors: { slug: "taken" }, values: raw };
  }
  revalidatePath("/[locale]/admin/affiliates", "page");
  return { ok: true, message: "saved" };
}

export async function affiliateCommandAction(id: string, command: "approved" | "paused" | "rejected" | "pending" | "delete") {
  await admin();
  const db = await getDb();
  if (command === "delete") await db.delete(schema.affiliatePartners).where(eq(schema.affiliatePartners.id, id));
  else
    await db
      .update(schema.affiliatePartners)
      .set({ status: command, updatedAt: new Date(), ...(command === "approved" ? { approvedAt: new Date() } : {}) })
      .where(eq(schema.affiliatePartners.id, id));
  revalidatePath("/[locale]/admin/affiliates", "page");
}

/* ───────────── Translations ───────────── */

export async function saveTranslationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await admin();
  const parsed = z
    .object({
      locale: z.enum(LOCALES),
      key: z.string().trim().regex(/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)+$/).max(200),
      value: z.string().max(4000),
      reviewed: z.preprocess((v) => v === "on", z.boolean()),
    })
    .safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
  const v = parsed.data;
  const db = await getDb();
  if (!v.value) await db.delete(schema.translationRecords).where(and(eq(schema.translationRecords.locale, v.locale), eq(schema.translationRecords.key, v.key)));
  else
    await db
      .insert(schema.translationRecords)
      .values({ locale: v.locale, key: v.key, value: v.value, reviewed: v.reviewed })
      .onConflictDoUpdate({ target: [schema.translationRecords.locale, schema.translationRecords.key], set: { value: v.value, reviewed: v.reviewed, updatedAt: new Date() } });
  revalidateTag("translations");
  return { ok: true, message: "saved" };
}

export async function markContactHandledAction(id: string) {
  await admin();
  const db = await getDb();
  await db.update(schema.contactMessages).set({ handled: true }).where(eq(schema.contactMessages.id, id));
  revalidatePath("/[locale]/admin", "page");
}
