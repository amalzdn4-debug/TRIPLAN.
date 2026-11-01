import "server-only";
import { and, desc, eq, gt, inArray, or, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { FREE_TRIPS_INCLUDED } from "@/config/site";

export type Entitlement = "subscription" | "free" | "credit";

const ACTIVE = ["active", "trialing"];

export async function getActiveSubscription(userId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.subscriptions)
    .where(
      and(
        eq(schema.subscriptions.userId, userId),
        inArray(schema.subscriptions.status, ACTIVE),
        or(isNull(schema.subscriptions.currentPeriodEnd), gt(schema.subscriptions.currentPeriodEnd, new Date())),
      ),
    )
    .orderBy(desc(schema.subscriptions.currentPeriodEnd))
    .limit(1);
  return rows[0] ?? null;
}

/** What would pay for the next new trip, without consuming anything. Server-side source of truth. */
export async function nextTripEntitlement(userId: string): Promise<Entitlement | null> {
  if (await getActiveSubscription(userId)) return "subscription";
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
  const sub = await getActiveSubscription(userId);
  return {
    tripsCreated: u?.total ?? 0,
    freeRemaining: Math.max(0, FREE_TRIPS_INCLUDED - (u?.total ?? 0)),
    credits: u?.credits ?? 0,
    subscription: sub,
  };
}
