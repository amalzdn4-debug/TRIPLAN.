import "server-only";
import type Stripe from "stripe";
import { features } from "@/lib/env";

let client: Stripe | null = null;

export async function getStripe(): Promise<Stripe | null> {
  if (!features.stripe()) return null;
  if (!client) {
    const { default: StripeCtor } = await import("stripe");
    client = new StripeCtor(process.env.STRIPE_SECRET_KEY as string, { appInfo: { name: "Triplan" } });
  }
  return client;
}
