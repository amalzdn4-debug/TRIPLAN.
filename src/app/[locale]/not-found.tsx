import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <section className="section" style={{ paddingBlockStart: "calc(var(--header-h) + 6rem)" }}>
      <div className="container container--narrow empty">
        <div className="icon-tile">
          <Icon name="compass" />
        </div>
        <h1>{t("title")}</h1>
        <p className="lead">{t("body")}</p>
        <div className="cluster" style={{ justifyContent: "center" }}>
          <Link href="/" className="btn btn--primary">{t("home")}</Link>
          <Link href="/explore" className="btn">{t("explore")}</Link>
        </div>
      </div>
    </section>
  );
}
