/**
 * The approved TriPlan logo (2026 brand kit, public/brand/2026 — supplied files, unmodified).
 *  • horizontal: symbol + "TriPlan.com" (primary)      • stacked: symbol above the name
 *  • wordmark:   "TriPlan.com" only                     • monogram: the TP. symbol only (compact uses)
 * Versions: light = for light backgrounds · dark = for navy/dark backgrounds · white/black = one colour.
 * The files include the brand's clear space, so sizes below are for the whole file.
 */
type Variant = "light" | "dark" | "white" | "black";

const SIZES = {
  horizontal: { w: 567.54, h: 150 },
  stacked: { w: 330.2, h: 220 },
  wordmark: { w: 729.42, h: 140 },
  monogram: { w: 121.25, h: 140 },
} as const;

export function Logo({ kind = "horizontal", variant = "light", height = 40, className, alt = "TriPlan" }: { kind?: keyof typeof SIZES; variant?: Variant; height?: number; className?: string; alt?: string }) {
  const { w, h } = SIZES[kind];
  const width = Math.round((w / h) * height);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/brand/2026/triplan-${kind}-${variant}.svg`} width={width} height={height} alt={alt} className={className} decoding="async" />;
}
