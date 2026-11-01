import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { siteUrl } from "@/config/site";
import { features, authSecret } from "@/lib/env";
import { hmac, safeEqual } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/guards";
import { isLocale } from "@/config/locales";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (locale = "en") => Response.redirect(`${siteUrl()}/${locale}/login?error=oauth`, 302);
  if (!features.googleAuth()) return fail();

  let state: { n: string; l: string; x: string };
  try {
    state = JSON.parse(Buffer.from(url.searchParams.get("state") ?? "", "base64url").toString());
  } catch {
    return fail();
  }
  const locale = isLocale(state.l) ? state.l : "en";
  const jar = await cookies();
  const cookie = jar.get("tp_oauth")?.value ?? "";
  jar.delete("tp_oauth");
  const [nonce, sig] = cookie.split(".");
  if (!nonce || !sig || nonce !== state.n || !safeEqual(sig, hmac(authSecret(), nonce))) return fail(locale);

  const code = url.searchParams.get("code");
  if (!code) return fail(locale);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: `${siteUrl()}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail(locale);
  const tokens = (await tokenRes.json()) as { id_token?: string };
  // The ID token comes straight from Google's token endpoint over TLS, so its claims can be trusted
  // without re-verifying the signature (OpenID Connect Core §3.1.3.7).
  const claims = tokens.id_token ? JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString()) : null;
  if (!claims?.sub || !claims.email || claims.email_verified !== true || claims.aud !== process.env.GOOGLE_CLIENT_ID) return fail(locale);

  const db = await getDb();
  const email = String(claims.email).toLowerCase();
  let [user] = await db.select({ id: schema.users.id, status: schema.users.status }).from(schema.users).where(eq(schema.users.googleSub, claims.sub));
  if (!user) {
    const [byEmail] = await db.select({ id: schema.users.id, status: schema.users.status }).from(schema.users).where(sql`lower(${schema.users.email}) = ${email}`);
    if (byEmail) {
      await db.update(schema.users).set({ googleSub: claims.sub, emailVerifiedAt: new Date() }).where(eq(schema.users.id, byEmail.id));
      user = byEmail;
    } else {
      const admin = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).includes(email);
      const [created] = await db.insert(schema.users).values({ email, googleSub: claims.sub, emailVerifiedAt: new Date(), role: admin ? "admin" : "user" }).returning({ id: schema.users.id, status: schema.users.status });
      await db.insert(schema.profiles).values({ userId: created.id, displayName: String(claims.name ?? email.split("@")[0]).slice(0, 80) });
      await db.insert(schema.userPreferences).values({ userId: created.id, locale });
      user = created;
    }
  }
  if (user.status !== "active") return fail(locale);
  await createSession(user.id);
  return Response.redirect(`${siteUrl()}/${locale}${safeNext(state.x, "/trips")}`, 302);
}
