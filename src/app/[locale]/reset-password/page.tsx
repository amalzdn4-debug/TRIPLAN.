import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/AuthForms";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return pageMetadata({ locale, path: "/reset-password", title: t("resetTitle"), description: t("resetTitle"), noindex: true });
}

export default async function ResetPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  setRequestLocale((await params).locale);
  const { token } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <AuthShell slide={9}>
      {token ? (
        <ResetForm token={token} />
      ) : (
        <div className="stack">
          <h1>{t("resetTitle")}</h1>
          <p className="muted">{t("resetMissing")}</p>
          <Link href="/forgot-password" className="btn btn--primary">{t("forgotCta")}</Link>
        </div>
      )}
    </AuthShell>
  );
}
