import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { getTranslationOverrides } from "@/lib/translation-overrides";

type Messages = Record<string, unknown>;

function deepMerge(base: Messages, overrides: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    const existing = out[k];
    if (v && typeof v === "object" && !Array.isArray(v) && existing && typeof existing === "object") {
      out[k] = deepMerge(existing as Messages, v as Messages);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const base = (await import(`../../messages/${locale}.json`)).default as Messages;
  // English is the fallback for any key missing in a translation.
  const fallback = locale === "en" ? base : deepMerge((await import(`../../messages/en.json`)).default as Messages, base);
  const overrides = await getTranslationOverrides(locale);
  return {
    locale,
    messages: deepMerge(fallback, overrides),
    timeZone: "UTC",
    onError(error) {
      if (process.env.NODE_ENV !== "production") console.warn("[i18n]", error.message);
    },
    getMessageFallback({ namespace, key }) {
      return [namespace, key].filter(Boolean).join(".");
    },
  };
});
