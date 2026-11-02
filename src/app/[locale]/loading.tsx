import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/layout/Logo";

/** Shown while a page loads: the TRIPLAN monogram with a calm pulse (no motion if reduced motion is set). */
export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <Logo kind="monogram" variant="teal" height={64} alt="" className="page-loading__mark" />
      <span className="page-loading__bar" aria-hidden />
      <span className="visually-hidden">{t("loading")}</span>
    </div>
  );
}
