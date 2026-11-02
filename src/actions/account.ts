"use server";

import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { deleteStored } from "@/lib/storage";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser, destroySession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { flattenErrors, formToObject, passwordSchema, preferencesSchema, profileSchema, type ActionState } from "@/lib/validation";
import { isLocale } from "@/config/locales";
import { getStripe } from "@/lib/stripe";

export async function updateProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "signInRequired" };
  const parsed = profileSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
  const db = await getDb();
  const v = { displayName: parsed.data.displayName, homeCity: parsed.data.homeCity || null, bio: parsed.data.bio || null, updatedAt: new Date() };
  await db.insert(schema.profiles).values({ userId: user.id, ...v }).onConflictDoUpdate({ target: schema.profiles.userId, set: v });
  revalidatePath("/[locale]/account", "page");
  return { ok: true, message: "saved" };
}

export async function updatePreferencesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "signInRequired" };
  const parsed = preferencesSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
  const db = await getDb();
  const v = { ...parsed.data, updatedAt: new Date() };
  await db.insert(schema.userPreferences).values({ userId: user.id, ...v }).onConflictDoUpdate({ target: schema.userPreferences.userId, set: v });
  const current = await getLocale();
  if (parsed.data.locale !== current) {
    (await cookies()).set("NEXT_LOCALE", parsed.data.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    redirect({ href: "/account", locale: parsed.data.locale });
  }
  return { ok: true, message: "saved" };
}

/** Called by the language selector so signed-in users keep their choice across devices. */
export async function saveLanguagePreferenceAction(locale: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isLocale(locale)) return;
  const db = await getDb();
  await db.insert(schema.userPreferences).values({ userId: user.id, locale }).onConflictDoUpdate({ target: schema.userPreferences.userId, set: { locale, updatedAt: new Date() } });
}

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "signInRequired" };
  const raw = formToObject(fd);
  const next = passwordSchema.safeParse(raw.newPassword);
  if (!next.success) return { ok: false, errors: { newPassword: next.error.issues[0]?.message ?? "invalid" } };
  if (raw.newPassword !== raw.confirm) return { ok: false, errors: { confirm: "passwordMismatch" } };
  const db = await getDb();
  const [row] = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, user.id));
  if (row?.hash && !(await verifyPassword(String(raw.currentPassword ?? ""), row.hash))) return { ok: false, errors: { currentPassword: "wrongPassword" } };
  await db.update(schema.users).set({ passwordHash: await hashPassword(next.data), updatedAt: new Date() }).where(eq(schema.users.id, user.id));
  return { ok: true, message: "passwordChanged" };
}

/** GDPR erasure: deletes the account and all personal data (cascades), cancels any subscription. */
export async function deleteAccountAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "signInRequired" };
  if (String(fd.get("confirm") ?? "").trim().toLowerCase() !== user.email.toLowerCase()) return { ok: false, errors: { confirm: "confirmEmail" } };
  const db = await getDb();
  const stripe = await getStripe();
  if (stripe) {
    const subs = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, user.id));
    for (const s of subs) {
      if (["active", "trialing", "past_due"].includes(s.status)) await stripe.subscriptions.cancel(s.stripeSubscriptionId).catch(() => undefined);
    }
  }
  // Uploaded photos are files in storage, not just rows: delete them too.
  const media = await db.select({ url: schema.mediaUploads.url }).from(schema.mediaUploads).where(eq(schema.mediaUploads.userId, user.id));
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  await deleteStored(media.map((m) => m.url));
  await destroySession();
  redirect({ href: { pathname: "/", query: { deleted: "1" } }, locale: await getLocale() });
  return { ok: true };
}
