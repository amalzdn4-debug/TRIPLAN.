import "server-only";
import { headers } from "next/headers";

/**
 * Fixed-window in-memory rate limiter. Adequate for a single instance and as a first line of
 * defence on serverless (limits apply per warm instance). For strict global limits, swap the
 * store for Redis/Upstash — the call sites don't change.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function rateLimit(action: string, limit: number, windowMs: number, identity?: string): Promise<boolean> {
  const key = `${action}:${identity ?? (await clientIp())}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
