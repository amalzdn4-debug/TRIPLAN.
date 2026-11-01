import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser, type SessionUser } from "./session";

/** Redirects to the login page (keeping the return path) when signed out. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const locale = await getLocale();
    redirect({ href: { pathname: "/login", query: { next: returnTo } }, locale });
  }
  return user as SessionUser;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") {
    const locale = await getLocale();
    redirect({ href: "/", locale });
  }
  return user;
}

/** Only allow same-site relative paths as post-login destinations (prevents open redirects). */
export { safeNext } from "./safe-next";
