"use server";

import { getLocale } from "next-intl/server";
import { getDb, schema } from "@/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendContactNotification } from "@/lib/email";
import { contactSchema, flattenErrors, formToObject, type ActionState } from "@/lib/validation";

export async function contactAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formToObject(fd);
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    // Honeypot filled → pretend success to bots.
    if (raw.website) return { ok: true, message: "contactSent" };
    return { ok: false, errors: flattenErrors(parsed.error), values: raw };
  }
  if (!(await rateLimit("contact", 3, 60 * 60_000))) return { ok: false, message: "rateLimited", values: raw };
  const db = await getDb();
  const { name, email, topic, message } = parsed.data;
  await db.insert(schema.contactMessages).values({ name, email, topic, message, locale: await getLocale() });
  await sendContactNotification({ name, email, topic, message });
  return { ok: true, message: "contactSent" };
}
