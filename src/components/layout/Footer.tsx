import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "./Logo";
import { LanguageSelector } from "./LanguageSelector";
import { CookieSettingsButton } from "./CookieConsent";
import { Icon } from "@/components/ui/Icon";

/** Social profiles are configured via env so no account is ever invented. */
const SOCIAL = [
  { key: "instagram", env: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM, label: "Instagram" },
  { key: "youtube", env: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE, label: "YouTube" },
  { key: "linkedin", env: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN, label: "LinkedIn" },
  { key: "x", env: process.env.NEXT_PUBLIC_SOCIAL_X, label: "X" },
].filter((s) => s.env);

export async function Footer({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Logo variant="white" />
            <p>{t("about")}</p>
          </div>
          <div>
            <h2>{t("product")}</h2>
            <ul>
              <li><Link href="/plan">{nav("plan")}</Link></li>
              <li><Link href="/explore">{nav("explore")}</Link></li>
              <li><Link href="/destinations">{nav("destinations")}</Link></li>
              <li><Link href="/trips">{nav("myTrips")}</Link></li>
              <li><Link href="/pricing">{t("pricing")}</Link></li>
            </ul>
          </div>
          <div>
            <h2>{t("company")}</h2>
            <ul>
              <li><Link href="/about">{t("aboutLink")}</Link></li>
              <li><Link href="/community">{nav("community")}</Link></li>
              <li><Link href="/reviews">{t("reviews")}</Link></li>
              <li><Link href="/faq">{t("faq")}</Link></li>
              <li><Link href="/contact">{t("contact")}</Link></li>
            </ul>
          </div>
          <div>
            <h2>{t("legal")}</h2>
            <ul>
              <li><Link href="/legal/privacy">{t("privacy")}</Link></li>
              <li><Link href="/legal/terms">{t("terms")}</Link></li>
              <li><Link href="/legal/cookies">{t("cookies")}</Link></li>
              <li><Link href="/legal/subscriptions">{t("subscriptions")}</Link></li>
              <li><CookieSettingsButton label={t("cookieSettings")} /></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {year} TRIPLAN. {t("rights")}</span>
          <div className="cluster">
            {SOCIAL.length ? (
              <div className="social">
                {SOCIAL.map((s) => (
                  <a key={s.key} href={s.env} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                    <Icon name={s.key} />
                  </a>
                ))}
              </div>
            ) : null}
            <LanguageSelector signedIn={signedIn} />
          </div>
        </div>
      </div>
    </footer>
  );
}
