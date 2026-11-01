import "server-only";

/** Feature flags derived from configuration. Nothing pretends to be active when it isn't. */
export const features = {
  ai: () => Boolean(process.env.ANTHROPIC_API_KEY),
  stripe: () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
  googleAuth: () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  email: () => Boolean(process.env.RESEND_API_KEY),
  googleRoutes: () => Boolean(process.env.GOOGLE_MAPS_API_KEY),
};

export const isProd = process.env.NODE_ENV === "production";

export function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    if (isProd) throw new Error("AUTH_SECRET must be set to a long random value in production.");
    return "dev-only-insecure-secret-change-me";
  }
  return s;
}
