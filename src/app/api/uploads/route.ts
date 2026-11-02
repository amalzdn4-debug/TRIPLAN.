import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { features } from "@/lib/env";
import { checkUpload } from "@/lib/media";
import { rateLimit } from "@/lib/rate-limit";
import { storeImage } from "@/lib/storage";

export const runtime = "nodejs";

/** Unattached uploads a member may have at once (protects storage from abuse). */
const MAX_PENDING = 24;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Same-site check on top of the SameSite=Lax session cookie. */
function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers may omit it
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

/** Uploads one photo for a community post. Body: multipart form with a single "file" field. */
export async function POST(req: Request) {
  if (!features.uploads()) return fail("uploadsDisabled", 503);
  if (!sameOrigin(req)) return fail("forbidden", 403);
  const user = await getCurrentUser();
  if (!user) return fail("signInRequired", 401);
  if (!user.emailVerified) return fail("verifyEmailFirst", 403);
  if (!(await rateLimit("upload", 40, 60 * 60_000, user.id))) return fail("rateLimited", 429);
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(schema.mediaUploads).where(and(eq(schema.mediaUploads.userId, user.id), eq(schema.mediaUploads.status, "pending")));
  if (n >= MAX_PENDING) return fail("tooManyPending", 429);

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return fail("unsupported", 400);
  }
  if (!file) return fail("empty", 400);
  const checked = checkUpload(new Uint8Array(await file.arrayBuffer()));
  if (!checked.ok) return fail(checked.problem, 400);

  const ext = checked.info.type === "image/webp" ? "webp" : "jpg";
  try {
    const stored = await storeImage(`community/${user.id}/photo.${ext}`, checked.bytes, checked.info.type);
    const [row] = await db
      .insert(schema.mediaUploads)
      .values({ userId: user.id, kind: "post_photo", url: stored.url, pathname: stored.pathname, contentType: checked.info.type, bytes: checked.bytes.length, width: checked.info.width, height: checked.info.height })
      .returning({ id: schema.mediaUploads.id, url: schema.mediaUploads.url, width: schema.mediaUploads.width, height: schema.mediaUploads.height });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("[uploads] store failed", err);
    return fail("storeFailed", 502);
  }
}
