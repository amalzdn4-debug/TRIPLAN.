import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { formatMoney } from "@/lib/format";
import type { Admission } from "@/lib/admission";

/**
 * Free / paid / optional extras / free on certain days — only what is known (an editor's verified
 * entry with its official source, or a public space). Unknown → "check the official website".
 */
export function AdmissionInfo({ admission, compact = false }: { admission: Admission | null; compact?: boolean }) {
  const t = useTranslations("admission");
  const locale = useLocale();
  if (!admission) return <span className="adm adm--unknown">{t("unknown")}</span>;
  const price = admission.price ? formatMoney(admission.price.amount, admission.price.currency, locale) : null;
  const label =
    admission.type === "free"
      ? admission.basis === "public_space"
        ? t("publicSpace")
        : t("free")
      : admission.type === "paid"
        ? price
          ? t("paidPrice", { price })
          : t("paid")
        : admission.type === "optional"
          ? price
            ? t("optionalPrice", { price })
            : t("optional")
          : price
            ? t("conditionalPrice", { price, when: admission.freeWhen ?? "" })
            : t("conditional", { when: admission.freeWhen ?? "" });
  return (
    <span className={`adm adm--${admission.type}`}>
      <Icon name={admission.type === "free" ? "check" : "ticket"} className="inline-icon" />
      {label}
      {admission.bookingRequired ? <> · <strong>{t("booking")}</strong></> : null}
      {!compact && admission.note ? <> · {admission.note}</> : null}
      {!compact && admission.basis === "editor" && admission.source ? (
        <>
          {" · "}
          <a href={admission.source} target="_blank" rel="noopener noreferrer">{t("officialPrices")}</a>
          {admission.checked ? <span className="muted"> ({t("checked", { month: admission.checked })})</span> : null}
        </>
      ) : null}
    </span>
  );
}
