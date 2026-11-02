import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { fillTemplate, paramsFromQuery } from "@/lib/affiliate-template";
import { visitorHash } from "@/lib/affiliates";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { siteUrl } from "@/config/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Outbound affiliate redirect: /api/go/<partner>?city=…&checkin=…
 * Only approved partners redirect; anything else goes back to the home page. A click is
 * recorded (without the IP address) and the visitor is sent to the partner's own host.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const home = NextResponse.redirect(new URL("/", siteUrl() || url.origin), 302);
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) return home;
  const db = await getDb();
  const [p] = await db
    .select()
    .from(schema.affiliatePartners)
    .where(and(eq(schema.affiliatePartners.slug, slug), eq(schema.affiliatePartners.status, "approved")));
  if (!p) return home;
  const query = paramsFromQuery(url.searchParams);
  const target = fillTemplate(p.linkTemplate, query);
  if (!target) return home;

  const ip = await clientIp();
  const ua = req.headers.get("user-agent") ?? "";
  // Count at most 30 clicks per visitor per hour so repeated clicks can't inflate the numbers.
  if (await rateLimit("go", 30, 60 * 60_000, `${ip}|${ua}`)) {
    const user = await getCurrentUser().catch(() => null);
    const src = url.searchParams.get("src");
    const dest = url.searchParams.get("dest");
    await db
      .insert(schema.affiliateClicks)
      .values({
        partnerId: p.id,
        userId: user?.id ?? null,
        visitorHash: visitorHash(ip, ua),
        source: src && /^[\w/-]{1,60}$/.test(src) ? src : null,
        destinationSlug: dest && /^[a-z0-9-]{1,60}$/.test(dest) ? dest : null,
        locale: typeof query.locale === "string" ? query.locale : null,
      })
      .catch((err) => console.error("[go] click not recorded", err));
  }
  const res = NextResponse.redirect(target, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
