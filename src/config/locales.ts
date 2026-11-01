export const LOCALES = ["en", "ar", "fr", "es", "it", "zh", "ru", "pt"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_META: Record<Locale, { nativeName: string; dir: "ltr" | "rtl"; htmlLang: string; intl: string }> = {
  en: { nativeName: "English", dir: "ltr", htmlLang: "en", intl: "en-GB" },
  ar: { nativeName: "العربية", dir: "rtl", htmlLang: "ar", intl: "ar" },
  fr: { nativeName: "Français", dir: "ltr", htmlLang: "fr", intl: "fr-FR" },
  es: { nativeName: "Español", dir: "ltr", htmlLang: "es", intl: "es-ES" },
  it: { nativeName: "Italiano", dir: "ltr", htmlLang: "it", intl: "it-IT" },
  zh: { nativeName: "简体中文", dir: "ltr", htmlLang: "zh-Hans", intl: "zh-CN" },
  ru: { nativeName: "Русский", dir: "ltr", htmlLang: "ru", intl: "ru-RU" },
  pt: { nativeName: "Português", dir: "ltr", htmlLang: "pt", intl: "pt-PT" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dirOf(locale: string): "ltr" | "rtl" {
  return isLocale(locale) ? LOCALE_META[locale].dir : "ltr";
}
