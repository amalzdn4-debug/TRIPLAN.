/** Renders the approved TRIPLAN artwork from /public/brand (supplied SVGs, unmodified; the stacked lockup reuses the same paths). */
type Variant = "teal" | "white" | "black";

const SIZES = {
  /** Horizontal: monogram + wordmark side by side (supplied artwork). */
  lockup: { w: 673.5, h: 148 },
  /** Stacked: the same monogram above the same wordmark (paths copied unchanged). */
  stacked: { w: 534.5, h: 305 },
  monogram: { w: 139, h: 148 },
  wordmark: { w: 534.5, h: 148 },
} as const;

export function Logo({ kind = "lockup", variant = "teal", height = 30, className, alt = "TRIPLAN" }: { kind?: keyof typeof SIZES; variant?: Variant; height?: number; className?: string; alt?: string }) {
  const { w, h } = SIZES[kind];
  const width = Math.round((w / h) * height);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/brand/triplan-${kind}-${variant}.svg`} width={width} height={height} alt={alt} className={className} decoding="async" />;
}
