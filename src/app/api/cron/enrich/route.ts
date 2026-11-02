import { NextResponse } from "next/server";
import { connectRaw } from "@/db/raw";
import { enrichBatch } from "@/lib/enrich/run";
import { revalidateTag } from "next/cache";
import { deleteStored } from "@/lib/storage";

// Vercel Cron calls this daily (see vercel.json): it cleans up abandoned photo uploads and continues
// the destination content import. It is protected by CRON_SECRET, which Vercel sends
// as "Authorization: Bearer <CRON_SECRET>". Without the secret configured, the endpoint is disabled.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await connectRaw();
  try {
    // 1) Photos uploaded but never attached to a post (abandoned drafts) are removed after a day.
    const stale = await db.query<{ url: string }>(`DELETE FROM media_uploads WHERE status = 'pending' AND created_at < now() - interval '24 hours' RETURNING url`);
    await deleteStored(stale.map((r) => r.url));
    // 2) Destination content import, within the remaining time.
    const summary = await enrichBatch(db, { budgetMs: 40_000 });
    if (summary.processed) revalidateTag("destinations");
    return NextResponse.json({ ...summary, staleUploadsRemoved: stale.length });
  } finally {
    await db.close();
  }
}
