/**
 * Wikimedia Commons: licence, author and a suitably sized thumbnail for each image file.
 * Only freely reusable licences are accepted, and every image keeps its credit and licence link.
 */
import { getJson, qs } from "./http";

export interface LicensedImage {
  file: string; // "File:Name.jpg"
  url: string; // thumbnail (≤ 1920 px wide) on upload.wikimedia.org
  width: number;
  height: number;
  author: string;
  license: string; // e.g. "CC BY-SA 4.0"
  licenseUrl: string | null;
  filePageUrl: string;
  heroEligible: boolean;
}

interface ImageInfo {
  url: string;
  width: number;
  height: number;
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  descriptionurl: string;
  mime: string;
  extmetadata?: Record<string, { value?: string } | undefined>;
}
interface CommonsResponse {
  query?: { normalized?: { from: string; to: string }[]; pages?: { title: string; missing?: boolean; imageinfo?: ImageInfo[] }[] };
}

/** Licences that allow reuse on a commercial website with attribution. */
const ACCEPTED_LICENSE = /^(cc0|public domain|pd\b|pd-|cc[- ]by(-sa)?[- ]\d|cc[- ]by(-sa)?$|attribution$|attribution-sharealike)/i;
/** File names that are almost never good destination photos. */
const NOT_A_PHOTO = /(\bmap\b|locator|location|\bflag\b|coat[_ ]of[_ ]arms|wappen|blason|\bseal\b|\blogo\b|emblem|montage|collage|diagram|chart|\bplan\b|\.svg$|\.tiff?$)/i;

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAcceptedLicense(short: string | undefined): boolean {
  return !!short && ACCEPTED_LICENSE.test(short.trim());
}

export function looksLikePhoto(file: string, mime: string): boolean {
  return /^image\/(jpeg|png|webp)$/.test(mime) && !NOT_A_PHOTO.test(file);
}

/** Resolves licences for up to 50 files per request. Unlicensed or non-photo files are dropped. */
export async function fetchLicensedImages(files: string[], width = 1920): Promise<Map<string, LicensedImage>> {
  const out = new Map<string, LicensedImage>();
  const unique = [...new Set(files.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const res = await getJson<CommonsResponse>(
      `https://commons.wikimedia.org/w/api.php?${qs({ action: "query", format: "json", formatversion: 2, prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: width, titles: batch.join("|"), origin: "*" })}`,
    );
    const rename = new Map((res.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of res.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (!info || page.missing) continue;
      const meta = info.extmetadata ?? {};
      const license = stripHtml(meta.LicenseShortName?.value ?? "");
      if (!isAcceptedLicense(license)) continue;
      if (!looksLikePhoto(page.title, info.mime)) continue;
      const author = stripHtml(meta.Artist?.value ?? meta.Credit?.value ?? "").slice(0, 120) || "Wikimedia Commons contributor";
      const w = info.thumbwidth ?? info.width;
      const h = info.thumbheight ?? info.height;
      const requested = rename.get(page.title) ?? page.title;
      const image: LicensedImage = {
        file: page.title,
        url: info.thumburl ?? info.url,
        width: w,
        height: h,
        author,
        license,
        licenseUrl: meta.LicenseUrl?.value ?? null,
        filePageUrl: info.descriptionurl,
        heroEligible: w >= 1600 && w / h >= 1.3 && w / h <= 2.4,
      };
      out.set(page.title, image);
      out.set(requested, image);
    }
  }
  return out;
}

/** Commons file name from a Wikidata P18 value (a Special:FilePath URL). */
export function fileFromCommonsUrl(url: string): string | null {
  const m = url.match(/Special:FilePath\/(.+)$/);
  return m ? `File:${decodeURIComponent(m[1]).replace(/_/g, " ")}` : null;
}

/** Same Wikimedia thumbnail at another standard width (Wikimedia prefers standard thumbnail steps). */
export function wikimediaThumb(url: string, width: 330 | 500 | 960 | 1280 | 1920): string {
  return url.replace(/\/(\d+)px-([^/]+)$/, `/${width}px-$2`);
}
