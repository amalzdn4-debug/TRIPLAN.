import type { Metadata } from "next";
import { LOCALES, LOCALE_META, type Locale } from "@/config/locales";
import { siteUrl } from "@/config/site";

/** Canonical + hreflang alternates for a locale-agnostic path like "/explore". */
export function alternates(locale: string, path: string): Metadata["alternates"] {
  const clean = path === "/" ? "" : path;
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[LOCALE_META[l as Locale].htmlLang] = `${siteUrl()}/${l}${clean}`;
  languages["x-default"] = `${siteUrl()}/en${clean}`;
  return { canonical: `${siteUrl()}/${locale}${clean}`, languages };
}

export function pageMetadata(opts: { locale: string; path: string; title: string; description: string; image?: string | null; noindex?: boolean }): Metadata {
  const image = opts.image || "/og.png";
  return {
    title: opts.title,
    description: opts.description,
    alternates: alternates(opts.locale, opts.path),
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: `${siteUrl()}/${opts.locale}${opts.path === "/" ? "" : opts.path}`,
      siteName: "TRIPLAN",
      locale: LOCALE_META[(opts.locale as Locale) ?? "en"]?.intl.replace("-", "_"),
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: "TRIPLAN" }],
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, images: [image] },
    robots: opts.noindex ? { index: false, follow: false } : undefined,
  };
}
