import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/AuthShell";
import { Link } from "@/i18n/navigation";
import { verifyEmailToken } from "@/actions/auth";
import { Notice } from "@/components/ui/Form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("verifiedTitle"), robots: { index: false, follow: false } };
}

export default async function VerifyEmailPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  setRequestLocale((await params).locale);
  const { token } = await searchParams;
  const t = await getTranslations("auth");
  const ok = token ? await verifyEmailToken(token) : false;
  return (
    <AuthShell slide={10}>
      <div className="stack">
        <h1>{ok ? t("verifiedTitle") : t("verifyFailedTitle")}</h1>
        <Notice tone={ok ? "success" : "warning"}>{ok ? t("verifiedBody") : t("verifyFailedBody")}</Notice>
        <Link href={ok ? "/trips" : "/account"} className="btn btn--primary">
          {ok ? t("continue") : t("goToAccount")}
        </Link>
      </div>
    </AuthShell>
  );
}
