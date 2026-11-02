import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteStored } from "@/lib/storage";

export const runtime = "nodejs";

/** Removes one of your own photos that hasn't been attached to a post yet. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "signInRequired" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "notFound" }, { status: 404 });
  const db = await getDb();
  const [row] = await db
    .delete(schema.mediaUploads)
    .where(and(eq(schema.mediaUploads.id, id), eq(schema.mediaUploads.userId, user.id), eq(schema.mediaUploads.status, "pending")))
    .returning({ url: schema.mediaUploads.url });
  if (!row) return NextResponse.json({ error: "notFound" }, { status: 404 });
  await deleteStored([row.url]);
  return new NextResponse(null, { status: 204 });
}
