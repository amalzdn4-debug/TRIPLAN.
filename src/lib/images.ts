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
}

export const isWikimedia = (url: string) => /^https:\/\/upload\.wikimedia\.org\//.test(url);

/** Wikimedia serves ready-made thumbnails at standard widths; use the smallest that fits the slot. */
export function sizedUrl(url: string, slot: "thumb" | "card" | "hero"): string {
  if (!isWikimedia(url)) return url;
  const width = slot === "thumb" ? 500 : slot === "card" ? 960 : 1920;
  return url.replace(/\/(\d+)px-([^/]+)$/, (_m, w: string, name: string) => `/${Math.min(Number(w), width)}px-${name}`);
}
