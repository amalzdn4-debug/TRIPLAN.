"use server";

import { getLocale } from "next-intl/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { redirect } from "@/i18n/navigation";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, destroyAllSessions, getCurrentUser } from "@/lib/auth/session";
import { issueToken, consumeToken } from "@/lib/auth/tokens";
import { safeNext } from "@/lib/auth/guards";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { features } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { flattenErrors, formToObject, forgotSchema, loginSchema, resetSchema, signupSchema, type ActionState } from "@/lib/validation";
import { isLocale } from "@/config/locales";

function isAdminEmail(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function signupAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formToObject(fd);
  const values = { name: raw.name, email: raw.email };
  if (!(await rateLimit("signup", 5, 15 * 60_000))) return { ok: false, message: "rateLimited", values };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values };
  const { name, email, password } = parsed.data;
  const locale = await getLocale();
  const db = await getDb();

  const existing = await db.select({ id: schema.users.id }).from(schema.users).where(sql`lower(${schema.users.email}) = ${email}`);
  if (existing.length) return { ok: false, errors: { email: "emailTaken" }, values };

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(schema.users)
    .values({ email, passwordHash, role: isAdminEmail(email) ? "admin" : "user" })
    .returning({ id: schema.users.id });
  await db.insert(schema.profiles).values({ userId: user.id, displayName: name });
  await db.insert(schema.userPreferences).values({ userId: user.id, locale: isLocale(locale) ? locale : "en" });

  const token = await issueToken(user.id, "verify_email");
  await sendVerificationEmail(email, token, locale);
  await createSession(user.id);
  redirect({ href: safeNext(raw.next, "/trips"), locale });
  return { ok: true };
}

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formToObject(fd);
  const values = { email: raw.email };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values };
  const { email, password } = parsed.data;
  if (!(await rateLimit("login", 10, 15 * 60_000)) || !(await rateLimit("login-email", 8, 15 * 60_000, email))) {
    return { ok: false, message: "rateLimited", values };
  }
  const db = await getDb();
  const [user] = await db
    .select({ id: schema.users.id, hash: schema.users.passwordHash, status: schema.users.status })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${email}`);
  const valid = await verifyPassword(password, user?.hash);
  if (!user || !valid || user.status !== "active") return { ok: false, message: "invalidCredentials", values };

  await createSession(user.id);
  const [pref] = await db.select({ locale: schema.userPreferences.locale }).from(schema.userPreferences).where(eq(schema.userPreferences.userId, user.id));
  const current = await getLocale();
  // Respect the language saved in the account, unless the user is already browsing in another one.
  const locale = pref?.locale && isLocale(pref.locale) && current === "en" ? pref.locale : current;
  redirect({ href: safeNext(raw.next, "/trips"), locale });
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect({ href: "/", locale: await getLocale() });
}

export async function forgotPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = forgotSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
  if (!(await rateLimit("forgot", 5, 15 * 60_000))) return { ok: false, message: "rateLimited" };
  const db = await getDb();
  const [user] = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users).where(sql`lower(${schema.users.email}) = ${parsed.data.email}`);
  // If the site can't send email at all, say so honestly (this reveals nothing about any account).
  if (!features.emailDelivery()) return { ok: false, message: "emailUnavailable" };
  if (user) {
    const token = await issueToken(user.id, "reset_password");
    await sendPasswordResetEmail(user.email, token, await getLocale());
  }
  // Same response either way, so the form can't be used to discover accounts.
  return { ok: true, message: "resetSent" };
}

export async function resetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
  const userId = await consumeToken(parsed.data.token, "reset_password");
  if (!userId) return { ok: false, message: "tokenInvalid" };
  const db = await getDb();
  await db.update(schema.users).set({ passwordHash: await hashPassword(parsed.data.password), updatedAt: new Date() }).where(eq(schema.users.id, userId));
  await destroyAllSessions(userId);
  await createSession(userId);
  redirect({ href: "/trips", locale: await getLocale() });
  return { ok: true };
}

export async function resendVerificationAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "signInRequired" };
  if (user.emailVerified) return { ok: true, message: "alreadyVerified" };
  if (!(await rateLimit("resend-verify", 3, 15 * 60_000, user.id))) return { ok: false, message: "rateLimited" };
  const token = await issueToken(user.id, "verify_email");
  const sent = await sendVerificationEmail(user.email, token, await getLocale());
  // Never say "sent" when nothing was delivered (e.g. the email service isn't connected yet).
  return sent ? { ok: true, message: "verificationSent" } : { ok: false, message: "emailUnavailable" };
}

/** Called from the verify-email page (server component) with the token from the link. */
export async function verifyEmailToken(token: string): Promise<boolean> {
  const userId = await consumeToken(token, "verify_email");
  if (!userId) return false;
  const db = await getDb();
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(and(eq(schema.users.id, userId)));
  return true;
}
