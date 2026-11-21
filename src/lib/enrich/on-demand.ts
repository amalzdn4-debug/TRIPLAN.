import "server-only";
import { revalidateTag } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * When someone plans a trip to a destination whose sights haven't been imported yet, import them first
 * (Wikipedia/Wikidata/Wikimedia Commons, the same importer as the admin button and the daily job).
 * Never blocks the trip: on timeout or error the trip is still created (meals and free time), and the
 * daily import finishes the destination later. Returns whether sights are now available.
 */
export async function ensureDestinationContent(destinationId: string, slug: string, timeoutMs = 30_000): Promise<boolean> {
  const db = await getDb();
  const count = async () =>
    (
      await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.places)
        .where(and(eq(schema.places.destinationId, destinationId), inArray(schema.places.kind, ["attraction", "activity"])))
    )[0]?.n ?? 0;
  if (Number(await count()) > 0) return true;
  const [d] = await db.select({ status: schema.destinations.enrichmentStatus }).from(schema.destinations).where(eq(schema.destinations.id, destinationId));
  // "done" with no sights means the sources had nothing to offer: don't retry on every trip.
  if (!d || d.status === "done") return false;
  try {
    const { connectRaw } = await import("@/db/raw");
    const { enrichBatch } = await import("@/lib/enrich/run");
    const raw = await connectRaw();
    try {
      await Promise.race([
        enrichBatch(raw, { budgetMs: timeoutMs, slugs: [slug] }),
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    } finally {
      await raw.close().catch(() => undefined);
    }
    revalidateTag("destinations");
  } catch (e) {
    console.error("[on-demand import]", slug, (e as Error).message);
  }
  return Number(await count()) > 0;
}
