import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getUsage } from "@/lib/entitlements";
import { Notice } from "@/components/ui/Form";

/** Tells the traveller up-front how this trip will be covered — never a surprise charge. */
export async function EntitlementBanner({ userId }: { userId: string }) {
  const t = await getTranslations("planner");
  const format = await getFormatter();
  const u = await getUsage(userId);
  if (u.admin) return <Notice tone="success">{t("coveredByAdmin")}</Notice>;
  const sub = u.subscription;
  if (sub && (sub.tripsIncluded == null || sub.tripsUsedInPeriod < sub.tripsIncluded)) {
    return (
      <Notice tone="success">
        {sub.tripsIncluded == null ? t("coveredBySubscription") : t("coveredByMonthly", { left: sub.tripsIncluded - sub.tripsUsedInPeriod, total: sub.tripsIncluded })}
      </Notice>
    );
  }
  if (u.freeRemaining > 0) return <Notice>{t("coveredByFree")}</Notice>;
  if (u.credits > 0) return <Notice>{t("coveredByCredit", { n: u.credits })}</Notice>;
  return (
    <Notice tone="warning">
      {sub ? t("periodUsedUp", { total: sub.tripsIncluded ?? 0, date: format.dateTime(sub.currentPeriodEnd ?? new Date(), { dateStyle: "medium" }) }) : t("needsPurchase")} <Link href="/pricing">{t("seePlans")}</Link>
    </Notice>
  );
}
