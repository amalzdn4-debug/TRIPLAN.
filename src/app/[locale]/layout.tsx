import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Manrope, Noto_Sans_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { LOCALE_META, type Locale } from "@/config/locales";
import { siteUrl } from "@/config/site";
import { alternates } from "@/lib/seo";
import { getCurrentUser } from "@/lib/auth/session";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { BackToTop } from "@/components/layout/BackToTop";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/components.css";

const manrope = Manrope({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-manrope", display: "swap" });
const notoArabic = Noto_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600"], variable: "--font-noto-arabic", display: "swap" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#173B67",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t("title"), template: `%s · TRIPLAN` },
    description: t("description"),
    applicationName: "TRIPLAN",
    alternates: alternates(locale, "/"),
    openGraph: { siteName: "TRIPLAN", images: ["/og.png"], type: "website" },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false, address: false, email: false },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const meta = LOCALE_META[locale as Locale];
  const messages = await getMessages();
  const user = await getCurrentUser();

  return (
    <html lang={meta.htmlLang} dir={meta.dir} className={`${manrope.variable} ${notoArabic.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <Footer signedIn={!!user} />
          <BottomNav signedIn={!!user} />
          <BackToTop />
          <CookieConsent />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
