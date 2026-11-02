/**
 * Wikipedia: article introduction, lead image, coordinates and Wikidata id, plus the introduction in
 * every other TRIPLAN language where an article exists. Text is CC BY-SA — the UI links to the source.
 */
import { getJson, qs } from "./http";

export const SITE_LANGS = ["en", "ar", "fr", "es", "it", "zh", "ru", "pt"] as const;
export type SiteLang = (typeof SITE_LANGS)[number];

export interface WikiArticle {
  title: string;
  url: string;
  extract: string;
  wikidataId: string | null;
  imageFile: string | null; // "File:Name.jpg"
  lat: number | null;
  lng: number | null;
  /** Localised introductions, keyed by language (only where an article exists). */
  extracts: Partial<Record<SiteLang, { title: string; url: string; extract: string }>>;
}

interface QueryPage {
  title: string;
  missing?: boolean;
  invalid?: boolean;
  extract?: string;
  fullurl?: string;
  pageimage?: string;
  coordinates?: { lat: number; lon: number }[];
  pageprops?: { wikibase_item?: string; disambiguation?: string };
  langlinks?: { lang: string; title: string }[];
}
interface QueryResponse {
  query?: { pages?: QueryPage[] };
  error?: { code: string; info: string };
}

const api = (lang: string) => `https://${lang}.wikipedia.org/w/api.php`;

/** Removes pronunciation guides and empty brackets that read badly in a short introduction. */
export function cleanExtract(text: string, maxChars = 1200): string {
  let t = text
    .replace(/\s*\([^()]*(?:pronunciation|pronounced|IPA|listen|[ˈˌ])[^()]*\)/gi, "")
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/\(\s*[;,]?\s*\)/g, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (t.length > maxChars) {
    const cut = t.slice(0, maxChars);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("。"), cut.lastIndexOf("۔"));
    t = end > maxChars * 0.5 ? cut.slice(0, end + 1) : cut.trimEnd() + "…";
  }
  return t;
}

/** First sentence(s) up to ~maxChars — used for short card summaries. */
export function shortSummary(text: string, maxChars = 160): string {
  const sentences = text.split(/(?<=[.!?。])\s+/);
  let out = "";
  for (const s of sentences) {
    if ((out + " " + s).trim().length > maxChars) break;
    out = (out + " " + s).trim();
  }
  if (!out) out = text.slice(0, maxChars - 1).trimEnd() + "…";
  return out;
}

export async function fetchArticle(title: string, langs: readonly SiteLang[] = SITE_LANGS): Promise<WikiArticle | null> {
  const params = {
    action: "query",
    format: "json",
    formatversion: 2,
    redirects: 1,
    titles: title,
    prop: "extracts|pageimages|coordinates|pageprops|info|langlinks",
    exintro: 1,
    explaintext: 1,
    piprop: "name",
    ppprop: "wikibase_item|disambiguation",
    inprop: "url",
    lllimit: "max",
    origin: "*",
  };
  const res = await getJson<QueryResponse>(`${api("en")}?${qs(params)}`);
  if (res.error) throw new Error(`Wikipedia: ${res.error.info}`);
  const page = res.query?.pages?.[0];
  if (!page || page.missing || page.invalid) return null;
  if (page.pageprops?.disambiguation !== undefined) throw new Error(`"${title}" is a disambiguation page — set a more specific Wikipedia title`);
  const article: WikiArticle = {
    title: page.title,
    url: page.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    extract: cleanExtract(page.extract ?? ""),
    wikidataId: page.pageprops?.wikibase_item ?? null,
    imageFile: page.pageimage ? `File:${page.pageimage}` : null,
    lat: page.coordinates?.[0]?.lat ?? null,
    lng: page.coordinates?.[0]?.lon ?? null,
    extracts: {},
  };
  if (article.extract) article.extracts.en = { title: article.title, url: article.url, extract: article.extract };

  const links = new Map((page.langlinks ?? []).map((l) => [l.lang, l.title]));
  for (const lang of langs) {
    if (lang === "en") continue;
    const local = links.get(lang);
    if (!local) continue;
    try {
      const r = await getJson<QueryResponse>(
        `${api(lang)}?${qs({ action: "query", format: "json", formatversion: 2, redirects: 1, titles: local, prop: "extracts|info", exintro: 1, explaintext: 1, inprop: "url", origin: "*", ...(lang === "zh" ? { variant: "zh-cn" } : {}) })}`,
      );
      const p = r.query?.pages?.[0];
      const text = cleanExtract(p?.extract ?? "");
      if (p && !p.missing && text) article.extracts[lang] = { title: p.title, url: p.fullurl ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title)}`, extract: text };
    } catch {
      // A missing translation is not an error — the English text is used for that language.
    }
  }
  return article;
}

/**
 * A display name from a Wikipedia article title in another language: drops disambiguation such as
 * "Lagos (Portugal)" → "Lagos", and a trailing region ("Bath, Somerset") unless the English name has one.
 */
export function cityNameFromTitle(title: string, englishName: string): string | null {
  let t = title.replace(/\s*[(（][^)）]*[)）]\s*$/u, "").trim();
  if (!englishName.includes(",")) t = t.replace(/[,，،]\s*[^,，،]+$/u, "").trim();
  return t && t.length <= 60 ? t : null;
}
