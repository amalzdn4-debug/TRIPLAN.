/** Image helpers shared by server and client components. */
export type ImageSource = "unsplash" | "wikimedia" | "upload";

export interface CreditedImage {
  url: string;
  alt: string;
  creditName: string | null;
  creditUrl: string | null;
  license?: string | null;
  licenseUrl?: string | null;
  source?: ImageSource | null;
  /** Other photos of the same place, tried in order if this one fails to load. */
  fallbacks?: string[];
}

export const isWikimedia = (url: string) => /^https:\/\/upload\.wikimedia\.org\//.test(url);

/**
 * Wikimedia only serves thumbnails at its standard widths to other websites (non-standard widths are
 * refused with an error since 2025/26: https://www.mediawiki.org/wiki/Common_thumbnail_sizes).
 * Always ask for a standard width that fits the slot and is not wider than the stored thumbnail.
 */
export const WIKIMEDIA_STEPS = [250, 330, 500, 960, 1280, 1920] as const;
export function sizedUrl(url: string, slot: "thumb" | "card" | "hero"): string {
  if (!isWikimedia(url)) return url;
  // Hero 1280 px: sharp on laptops and about half the download of 1920 px.
  const target = slot === "thumb" ? 500 : slot === "card" ? 960 : 1280;
  return url.replace(/\/(\d+)px-([^/]+)$/, (m, w: string, name: string) => {
    const limit = Math.min(Number(w), target);
    const step = [...WIKIMEDIA_STEPS].reverse().find((x) => x <= limit);
    return step ? `/${step}px-${name}` : m;
  });
}
