import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook — the only place where paid access is granted.
 * Signature is verified with STRIPE_WEBHOOK_SECRET; events are processed idempotently.
 */
export async function POST(req: Request) {
  const stripe = await getStripe();
  if (!stripe) return new Response("Stripe not configured", { status: 501 });
  const signature = req.headers.get("stripe-signature");
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const db = await getDb();
  const fresh = await db.insert(schema.stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning();
  if (!fresh.length) return Response.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.metadata?.userId ?? s.client_reference_id;
        const planId = s.metadata?.planId;
        if (!userId || !planId) break;
        if (s.mode === "payment" && s.payment_status === "paid") {
          const inserted = await db
            .insert(schema.payments)
            .values({ userId, planId, stripeSessionId: s.id, amountCents: s.amount_total ?? 0, currency: (s.currency ?? "eur").toUpperCase(), status: "paid" })
            .onConflictDoNothing()
            .returning({ id: schema.payments.id });
          if (inserted.length) {
            const [plan] = await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.id, planId));
            const credits = plan?.tripsIncluded ?? 1;
            await db.update(schema.users).set({ tripCredits: sql`${schema.users.tripCredits} + ${credits}` }).where(eq(schema.users.id, userId));
          }
        }
        if (s.mode === "subscription" && s.subscription) {
          const sub = await stripe.subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
          await upsertSubscription(sub, userId, planId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(sub, sub.metadata?.userId, sub.metadata?.planId);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null };
        const customer = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        if (!customer) break;
        const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.stripeCustomerId, customer));
        if (!u) break;
        await db
          .insert(schema.payments)
          .values({
            userId: u.id,
            planId: "annual",
            stripeInvoiceId: inv.id,
            amountCents: event.type === "invoice.paid" ? inv.amount_paid : inv.amount_due,
            currency: (inv.currency ?? "eur").toUpperCase(),
            status: event.type === "invoice.paid" ? "paid" : "failed",
          })
          .onConflictDoNothing();
        break;
      }
    }
  } catch (err) {
    // Let Stripe retry: remove the idempotency marker so the retry is processed.
    await db.delete(schema.stripeEvents).where(eq(schema.stripeEvents.id, event.id));
    console.error("[stripe] webhook processing failed", err);
    return new Response("Webhook processing failed", { status: 500 });
  }
  return Response.json({ received: true });
}

async function upsertSubscription(sub: Stripe.Subscription, userId?: string | null, planId?: string | null) {
  const db = await getDb();
  let uid = userId ?? null;
  if (!uid) {
    const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.stripeCustomerId, customer));
    uid = u?.id ?? null;
  }
  if (!uid) return;
  // current_period_end moved onto subscription items in newer API versions; support both.
  const periodEndUnix =
    (sub as unknown as { current_period_end?: number }).current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
  const values = {
    userId: uid,
    planId: planId || "annual",
    stripeSubscriptionId: sub.id,
    status: sub.status,
    currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    updatedAt: new Date(),
  };
  await db
    .insert(schema.subscriptions)
    .values(values)
    .onConflictDoUpdate({ target: schema.subscriptions.stripeSubscriptionId, set: { status: values.status, currentPeriodEnd: values.currentPeriodEnd, cancelAtPeriodEnd: values.cancelAtPeriodEnd, updatedAt: values.updatedAt } });
}
