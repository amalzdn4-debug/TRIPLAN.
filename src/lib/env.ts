import "server-only";

/** Feature flags derived from configuration. Nothing pretends to be active when it isn't. */
export const features = {
  ai: () => Boolean(process.env.ANTHROPIC_API_KEY),
  stripe: () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
  googleAuth: () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  email: () => Boolean(process.env.RESEND_API_KEY),
  googleRoutes: () => Boolean(process.env.GOOGLE_MAPS_API_KEY),
  /** Photo uploads (Vercel Blob). Set automatically when a Blob store is connected to the project. */
  uploads: () => Boolean(process.env.BLOB_READ_WRITE_TOKEN),
};

/** "test" when Stripe test keys are configured: test payments are labelled and never counted as revenue. */
export function stripeMode(): "test" | "live" | null {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!features.stripe()) return null;
  return key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "live" : "test";
}

export const isProd = process.env.NODE_ENV === "production";

export function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    if (isProd) throw new Error("AUTH_SECRET must be set to a long random value in production.");
    return "dev-only-insecure-secret-change-me";
  }
  return s;
}
