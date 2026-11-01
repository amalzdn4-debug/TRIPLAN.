import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** GDPR data portability: a JSON export of everything Triplan stores about the signed-in user. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const db = await getDb();
  const id = user.id;
  const [account] = await db
    .select({ email: schema.users.email, role: schema.users.role, emailVerifiedAt: schema.users.emailVerifiedAt, createdAt: schema.users.createdAt, tripCredits: schema.users.tripCredits })
    .from(schema.users)
    .where(eq(schema.users.id, id));
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, id));
  const [preferences] = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, id));
  const trips = await db.select().from(schema.trips).where(eq(schema.trips.userId, id));
  const stops = await db.select().from(schema.itineraryStops).innerJoin(schema.trips, eq(schema.trips.id, schema.itineraryStops.tripId)).where(eq(schema.trips.userId, id));
  const posts = await db.select().from(schema.communityPosts).where(eq(schema.communityPosts.userId, id));
  const reviews = await db.select().from(schema.platformReviews).where(eq(schema.platformReviews.userId, id));
  const saved = await db.select().from(schema.savedItems).where(eq(schema.savedItems.userId, id));
  const payments = await db.select().from(schema.payments).where(eq(schema.payments.userId, id));
  const subscriptions = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, id));
  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), account, profile, preferences, trips, itineraryStops: stops.map((s) => s.itinerary_stops), posts, reviews, saved, payments, subscriptions },
    null,
    2,
  );
  return new Response(body, {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="triplan-export-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
  });
}
