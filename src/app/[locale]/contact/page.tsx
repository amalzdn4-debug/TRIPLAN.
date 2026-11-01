import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ContactForm } from "@/components/ui/ContactForm";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return pageMetadata({ locale, path: "/contact", title: t("title"), description: t("lead") });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  const user = await getCurrentUser();
  return (
    <>
      <header className="page-header">
        <div className="container">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1>{t("title")}</h1>
          <p className="lead">{t("lead")}</p>
        </div>
      </header>
      <section className="section section--tight">
        <div className="container dest-layout">
          <ContactForm defaults={user ? { name: user.displayName, email: user.email } : undefined} />
          <aside className="dest-aside">
            <div className="card stack small">
              <strong>{t("beforeTitle")}</strong>
              <p className="muted" style={{ margin: 0 }}>{t("beforeBody")}</p>
              <Link href="/faq">{t("faqLink")}</Link>
            </div>
            <div className="card card--muted card--flat small">
              <p style={{ margin: 0 }}>{t("responseNote")}</p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
