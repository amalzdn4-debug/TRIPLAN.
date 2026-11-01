import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { randomToken, sha256 } from "./crypto";
import { isProd } from "@/lib/env";

export const SESSION_COOKIE = isProd ? "__Host-tp_session" : "tp_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  role: "user" | "admin";
  emailVerified: boolean;
  displayName: string;
  locale: string;
  currency: string;
  tripCredits: number;
  tripsCreatedTotal: number;
}

/** Creates a session row and sets the cookie. Call only from Server Actions / Route Handlers. */
export async function createSession(userId: string): Promise<void> {
  const db = await getDb();
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db.insert(schema.sessions).values({ id: sha256(token), userId, expiresAt, userAgent: ua });
  // Opportunistic cleanup of this user's expired sessions.
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, userId), lt(schema.sessions.expiresAt, new Date())));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

/** Current user for this request (memoised per request). Returns null when signed out. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const db = await getDb();
    const rows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
        status: schema.users.status,
        emailVerifiedAt: schema.users.emailVerifiedAt,
        tripCredits: schema.users.tripCredits,
        tripsCreatedTotal: schema.users.tripsCreatedTotal,
        displayName: schema.profiles.displayName,
        locale: schema.userPreferences.locale,
        currency: schema.userPreferences.currency,
      })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .leftJoin(schema.userPreferences, eq(schema.userPreferences.userId, schema.users.id))
      .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
      .limit(1);
    const u = rows[0];
    if (!u || u.status !== "active") return null;
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      emailVerified: Boolean(u.emailVerifiedAt),
      displayName: u.displayName || u.email.split("@")[0],
      locale: u.locale ?? "en",
      currency: u.currency ?? "EUR",
      tripCredits: u.tripCredits,
      tripsCreatedTotal: u.tripsCreatedTotal,
    };
  } catch (err) {
    console.error("[auth] session lookup failed", err);
    return null;
  }
});
