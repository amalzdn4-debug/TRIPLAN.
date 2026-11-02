import "server-only";
import { and, desc, eq, gt, inArray, or, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { FREE_TRIPS_INCLUDED } from "@/config/site";

export type Entitlement = "subscription" | "free" | "credit";

const ACTIVE = ["active", "trialing"];

export interface SubscriptionView {
  id: string;
  planId: string;
  billing: "free" | "one_time" | "monthly" | "yearly";
  status: string;
  /** null = unlimited (fair use) */
  tripsIncluded: number | null;
  tripsUsedInPeriod: number;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  livemode: boolean;
  stripeSubscriptionId: string;
}

/** Active subscriptions with their plan, best first (unlimited, then most trips left). */
export async function getActiveSubscriptions(userId: string): Promise<SubscriptionView[]> {
  const db = await getDb();
  const rows = await db
    .select({ s: schema.subscriptions, billing: schema.subscriptionPlans.billing, tripsIncluded: schema.subscriptionPlans.tripsIncluded })
    .from(schema.subscriptions)
    .innerJoin(schema.subscriptionPlans, eq(schema.subscriptionPlans.id, schema.subscriptions.planId))
    .where(
      and(
        eq(schema.subscriptions.userId, userId),
        inArray(schema.subscriptions.status, ACTIVE),
        or(isNull(schema.subscriptions.currentPeriodEnd), gt(schema.subscriptions.currentPeriodEnd, new Date())),
      ),
    )
    .orderBy(desc(schema.subscriptions.currentPeriodEnd));
  const subs = rows.map(({ s, billing, tripsIncluded }) => ({
    id: s.id,
    planId: s.planId,
    billing,
    status: s.status,
    tripsIncluded,
    tripsUsedInPeriod: s.tripsUsedInPeriod,
    currentPeriodStart: s.currentPeriodStart,
    currentPeriodEnd: s.currentPeriodEnd,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    livemode: s.livemode,
    stripeSubscriptionId: s.stripeSubscriptionId,
  }));
  const left = (s: SubscriptionView) => (s.tripsIncluded == null ? Infinity : s.tripsIncluded - s.tripsUsedInPeriod);
  return subs.sort((a, b) => left(b) - left(a));
}

export async function getActiveSubscription(userId: string): Promise<SubscriptionView | null> {
  return (await getActiveSubscriptions(userId))[0] ?? null;
}

const hasTripsLeft = (s: SubscriptionView) => s.tripsIncluded == null || s.tripsUsedInPeriod < s.tripsIncluded;

/** What would pay for the next new trip, without consuming anything. Server-side source of truth. */
export async function nextTripEntitlement(userId: string): Promise<Entitlement | null> {
  if ((await getActiveSubscriptions(userId)).some(hasTripsLeft)) return "subscription";
  const db = await getDb();
  const [u] = await db.select({ total: schema.users.tripsCreatedTotal, credits: schema.users.tripCredits }).from(schema.users).where(eq(schema.users.id, userId));
  if (!u) return null;
  if (u.total < FREE_TRIPS_INCLUDED) return "free";
  if (u.credits > 0) return "credit";
  return null;
}

export async function getUsage(userId: string) {
  const db = await getDb();
  const [u] = await db.select({ total: schema.users.tripsCreatedTotal, credits: schema.users.tripCredits }).from(schema.users).where(eq(schema.users.id, userId));
  const subs = await getActiveSubscriptions(userId);
  const sub = subs[0] ?? null;
  return {
    tripsCreated: u?.total ?? 0,
    freeRemaining: Math.max(0, FREE_TRIPS_INCLUDED - (u?.total ?? 0)),
    credits: u?.credits ?? 0,
    /** The best active subscription (may have no trips left this period). */
    subscription: sub,
    /** Trips left in the current billing period across subscriptions (null = unlimited). */
    subscriptionTripsLeft: subs.some((s) => s.tripsIncluded == null) ? null : subs.reduce((n, s) => n + Math.max(0, (s.tripsIncluded ?? 0) - s.tripsUsedInPeriod), 0),
  };
}
