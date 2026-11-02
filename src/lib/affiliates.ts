import "server-only";
import crypto from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { authSecret } from "@/lib/env";
import type { OutboundLink } from "@/lib/links";
import type { TemplateParams } from "@/lib/affiliate-template";

export type AffiliateCategory = (typeof schema.AFFILIATE_CATEGORIES)[number];

/** Which partner categories fit each group of outbound links shown on the site. */
const FOR_LINKS: Record<OutboundLink["category"], AffiliateCategory[]> = {
  accommodation: ["accommodation"],
  flights: ["flights"],
  activities: ["activities"],
  transport: ["transport", "car_rental"],
  luggage: ["luggage"],
  restaurants: [],
};

/**
 * Approved partner links for a group, routed through /api/go so clicks can be counted.
 * Only partners an admin has marked "approved" are ever returned.
 */
export async function partnerLinks(groups: OutboundLink["category"][], ctx: TemplateParams & { source: string; destination?: string | null }): Promise<OutboundLink[]> {
  const cats = [...new Set(groups.flatMap((g) => FOR_LINKS[g]))];
  if (!cats.length) return [];
  let rows: (typeof schema.affiliatePartners.$inferSelect)[] = [];
  try {
    const db = await getDb();
    rows = await db
      .select()
      .from(schema.affiliatePartners)
      .where(and(eq(schema.affiliatePartners.status, "approved"), inArray(schema.affiliatePartners.category, cats)))
      .orderBy(asc(schema.affiliatePartners.sortOrder), asc(schema.affiliatePartners.name));
  } catch (err) {
    console.error("[affiliates] unavailable", err);
    return [];
  }
  return rows.map((p) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(ctx)) if (v != null && v !== "" && k !== "source" && k !== "destination") q.set(k, String(v));
    q.set("src", ctx.source);
    if (ctx.destination) q.set("dest", ctx.destination);
    const group = (Object.keys(FOR_LINKS) as OutboundLink["category"][]).find((g) => FOR_LINKS[g].includes(p.category as AffiliateCategory) && groups.includes(g)) ?? groups[0];
    return { provider: p.name, url: `/api/go/${p.slug}?${q.toString()}`, category: group, partner: true };
  });
}

/** Partner links first (labelled), then the plain search links. */
export async function withPartners(links: OutboundLink[], ctx: TemplateParams & { source: string; destination?: string | null }): Promise<OutboundLink[]> {
  const groups = [...new Set(links.map((l) => l.category))];
  const partners = await partnerLinks(groups, ctx);
  const names = new Set(partners.map((p) => p.provider.toLowerCase()));
  // If a partner replaces a plain link to the same provider, show only the partner version.
  return [...partners, ...links.filter((l) => !names.has(l.provider.toLowerCase()))];
}

/** Counts unique visitors per day without storing IP addresses (the salt rotates daily). */
export function visitorHash(ip: string, userAgent: string, day = new Date().toISOString().slice(0, 10)): string {
  return crypto.createHmac("sha256", authSecret()).update(`${day}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}
