import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getUsage } from "@/lib/entitlements";
import { Notice } from "@/components/ui/Form";

/** Tells the traveller up-front how this trip will be covered — never a surprise charge. */
export async function EntitlementBanner({ userId }: { userId: string }) {
  const t = await getTranslations("planner");
  const u = await getUsage(userId);
  if (u.subscription) return <Notice tone="success">{t("coveredBySubscription")}</Notice>;
  if (u.freeRemaining > 0) return <Notice>{t("coveredByFree")}</Notice>;
  if (u.credits > 0) return <Notice>{t("coveredByCredit", { n: u.credits })}</Notice>;
  return (
    <Notice tone="warning">
      {t("needsPurchase")} <Link href="/pricing">{t("seePlans")}</Link>
    </Notice>
  );
}
