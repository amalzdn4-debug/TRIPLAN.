"use server";

import { getLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { redirect as nextRedirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getStripe } from "@/lib/stripe";
import { siteUrl } from "@/config/site";
import { rateLimit } from "@/lib/rate-limit";

async function ensureCustomer(userId: string, email: string) {
  const stripe = (await getStripe())!;
  const db = await getDb();
  const [u] = await db.select({ customer: schema.users.stripeCustomerId }).from(schema.users).where(eq(schema.users.id, userId));
  if (u?.customer) return u.customer;
  const customer = await stripe.customers.create({ email, metadata: { userId } });
  await db.update(schema.users).set({ stripeCustomerId: customer.id }).where(eq(schema.users.id, userId));
  return customer.id;
}

/**
 * Starts Stripe Checkout. Access is NOT granted here — only the verified webhook
 * (/api/stripe/webhook) credits trips or activates the subscription.
 */
export async function startCheckoutAction(fd: FormData): Promise<void> {
  const locale = await getLocale();
  const user = await getCurrentUser();
  const planId = String(fd.get("planId") ?? "");
  if (!user) {
    redirect({ href: { pathname: "/login", query: { next: "/pricing" } }, locale });
    return;
  }
  const stripe = await getStripe();
  if (!stripe) {
    redirect({ href: { pathname: "/pricing", query: { status: "unavailable" } }, locale });
    return;
  }
  if (!(await rateLimit("checkout", 10, 10 * 60_000, user.id))) {
    redirect({ href: { pathname: "/pricing", query: { status: "rate" } }, locale });
    return;
  }
  const db = await getDb();
  const [plan] = await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.id, planId));
  if (!plan || !plan.active || plan.billing === "free") {
    redirect({ href: "/pricing", locale });
    return;
  }
  const customer = await ensureCustomer(user.id, user.email);
  const base = `${siteUrl()}/${locale}`;
  const session = await stripe.checkout.sessions.create({
    mode: plan.billing === "yearly" ? "subscription" : "payment",
    customer,
    client_reference_id: user.id,
    metadata: { userId: user.id, planId: plan.id },
    ...(plan.billing === "yearly" ? { subscription_data: { metadata: { userId: user.id, planId: plan.id } } } : {}),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: plan.currency.toLowerCase(),
          unit_amount: plan.priceCents,
          product_data: { name: `Triplan — ${plan.name}` },
          ...(plan.billing === "yearly" ? { recurring: { interval: "year" as const } } : {}),
        },
      },
    ],
    locale: (["en", "fr", "es", "it", "zh", "ru", "pt"].includes(locale) ? locale : "auto") as "auto",
    success_url: `${base}/account/billing?checkout=success`,
    cancel_url: `${base}/pricing?checkout=cancelled`,
    allow_promotion_codes: true,
  });
  if (session.url) nextRedirect(session.url);
}

export async function openBillingPortalAction(): Promise<void> {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: { pathname: "/login", query: { next: "/account/billing" } }, locale });
    return;
  }
  const stripe = await getStripe();
  if (!stripe) {
    redirect({ href: { pathname: "/account/billing", query: { status: "unavailable" } }, locale });
    return;
  }
  const customer = await ensureCustomer(user.id, user.email);
  const portal = await stripe.billingPortal.sessions.create({ customer, return_url: `${siteUrl()}/${locale}/account/billing` });
  nextRedirect(portal.url);
}
