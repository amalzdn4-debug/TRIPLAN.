import { cookies } from "next/headers";
import { siteUrl } from "@/config/site";
import { features, authSecret, isProd } from "@/lib/env";
import { hmac, randomToken } from "@/lib/auth/crypto";
import { safeNext } from "@/lib/auth/guards";
import { isLocale } from "@/config/locales";

export const dynamic = "force-dynamic";

/** Starts Google sign-in (OpenID Connect authorization-code flow). Only active when configured. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = isLocale(url.searchParams.get("locale")) ? url.searchParams.get("locale")! : "en";
  if (!features.googleAuth()) return Response.redirect(`${siteUrl()}/${locale}/login`, 302);
  const next = safeNext(url.searchParams.get("next"), "/trips");
  const nonce = randomToken(16);
  const state = Buffer.from(JSON.stringify({ n: nonce, l: locale, x: next })).toString("base64url");
  (await cookies()).set("tp_oauth", `${nonce}.${hmac(authSecret(), nonce)}`, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/api/auth", maxAge: 600 });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: `${siteUrl()}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}
