"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setCancelAtPeriodEndAction } from "@/actions/billing";

/** Cancel at period end / keep subscription. Stripe confirms the change; the page then refreshes. */
export function SubscriptionControls({ cancelAtPeriodEnd, endDate }: { cancelAtPeriodEnd: boolean; endDate: string }) {
  const t = useTranslations("billing");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const run = (cancel: boolean) =>
    start(async () => {
      const r = await setCancelAtPeriodEndAction(cancel);
      setError(!r.ok);
      if (r.ok) router.refresh();
    });
  return (
    <div className="stack" style={{ gap: 8 }}>
      {cancelAtPeriodEnd ? (
        <button type="button" className="btn btn--sm btn--primary" disabled={pending} onClick={() => run(false)}>
          {pending ? <span className="spinner" aria-hidden /> : null}
          {t("resume")}
        </button>
      ) : (
        <button type="button" className="btn btn--sm btn--danger" disabled={pending} onClick={() => confirm(t("confirmCancel", { date: endDate })) && run(true)}>
          {pending ? <span className="spinner" aria-hidden /> : null}
          {t("cancel")}
        </button>
      )}
      {error ? <p className="small" role="alert" style={{ color: "var(--color-danger)", margin: 0 }}>{t("cancelFailed")}</p> : null}
    </div>
  );
}
