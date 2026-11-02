import type Stripe from "stripe";
import { desc, eq, sql } from "drizzle-orm";
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
            .values({ userId, planId, stripeSessionId: s.id, amountCents: s.amount_total ?? 0, currency: (s.currency ?? "eur").toUpperCase(), status: "paid", livemode: event.livemode })
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
          await upsertSubscription(sub, userId, planId, event.livemode);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const evSub = event.data.object as Stripe.Subscription;
        // Events can arrive out of order: use the subscription's current state from Stripe.
        const sub = event.type === "customer.subscription.deleted" ? evSub : ((await stripe.subscriptions.retrieve(evSub.id).catch(() => null)) ?? evSub);
        await upsertSubscription(sub, sub.metadata?.userId, sub.metadata?.planId, event.livemode);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice & {
          subscription?: string | { id: string } | null;
          parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
        };
        const customer = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        if (!customer) break;
        const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.stripeCustomerId, customer));
        if (!u) break;
        // The subscription id moved under invoice.parent in newer API versions; support both.
        const subRef = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        const [known] = subId ? await db.select({ planId: schema.subscriptions.planId }).from(schema.subscriptions).where(eq(schema.subscriptions.stripeSubscriptionId, subId)) : [];
        const [latest] = known ? [known] : await db.select({ planId: schema.subscriptions.planId }).from(schema.subscriptions).where(eq(schema.subscriptions.userId, u.id)).orderBy(desc(schema.subscriptions.createdAt)).limit(1);
        if (!latest) break;
        await db
          .insert(schema.payments)
          .values({
            userId: u.id,
            planId: latest.planId,
            livemode: event.livemode,
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

async function upsertSubscription(sub: Stripe.Subscription, userId: string | null | undefined, planId: string | null | undefined, livemode: boolean) {
  const db = await getDb();
  let uid = userId ?? null;
  if (!uid) {
    const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.stripeCustomerId, customer));
    uid = u?.id ?? null;
  }
  if (!uid) return;
  // The billing period moved onto subscription items in newer API versions; support both.
  const legacy = sub as unknown as { current_period_start?: number; current_period_end?: number };
  const item = sub.items?.data?.[0] as unknown as { current_period_start?: number; current_period_end?: number } | undefined;
  const startUnix = legacy.current_period_start ?? item?.current_period_start ?? null;
  const endUnix = legacy.current_period_end ?? item?.current_period_end ?? null;
  const start = startUnix ? new Date(startUnix * 1000) : null;
  const end = endUnix ? new Date(endUnix * 1000) : null;
  const values = {
    userId: uid,
    planId: planId || (await planForPrice(sub)) || "annual",
    stripeSubscriptionId: sub.id,
    status: sub.status,
    currentPeriodStart: start,
    currentPeriodEnd: end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    livemode,
    updatedAt: new Date(),
  };
  const t = schema.subscriptions;
  const newer = start ? sql`(${t.currentPeriodStart} is null or ${start.toISOString()}::timestamptz > ${t.currentPeriodStart})` : sql`false`;
  await db
    .insert(t)
    .values(values)
    .onConflictDoUpdate({
      target: t.stripeSubscriptionId,
      set: {
        status: values.status,
        cancelAtPeriodEnd: values.cancelAtPeriodEnd,
        canceledAt: values.canceledAt,
        updatedAt: values.updatedAt,
        // A renewal starts a new billing period: the monthly trip counter resets. Periods never move backwards.
        tripsUsedInPeriod: sql`case when ${newer} then 0 else ${t.tripsUsedInPeriod} end`,
        currentPeriodStart: sql`case when ${newer} then ${start ? start.toISOString() : null}::timestamptz else ${t.currentPeriodStart} end`,
        currentPeriodEnd: sql`case when ${newer} or ${t.currentPeriodEnd} is null then ${end ? end.toISOString() : null}::timestamptz else greatest(${t.currentPeriodEnd}, ${end ? end.toISOString() : null}::timestamptz) end`,
      },
    });
}

/** Subscriptions created outside Checkout (e.g. in the Stripe dashboard) have no plan metadata. */
async function planForPrice(sub: Stripe.Subscription): Promise<string | null> {
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
  if (interval === "month") return "monthly";
  if (interval === "year") return "annual";
  return null;
}
