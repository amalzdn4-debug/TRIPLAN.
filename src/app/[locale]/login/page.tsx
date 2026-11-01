import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/AuthForms";
import { features } from "@/lib/env";
import { safeNext } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return pageMetadata({ locale, path: "/login", title: t("loginTitle"), description: t("loginLead"), noindex: true });
}

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string; error?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const next = sp.next ? safeNext(sp.next) : undefined;
  if (await getCurrentUser()) redirect({ href: next ?? "/trips", locale });
  return (
    <AuthShell slide={1}>
      <LoginForm next={next} google={features.googleAuth()} oauthError={sp.error === "oauth"} />
    </AuthShell>
  );
}
