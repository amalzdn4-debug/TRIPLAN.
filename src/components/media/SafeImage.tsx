"use client";

import Image from "next/image";
import { useState } from "react";
import { isWikimedia, sizedUrl } from "@/lib/images";

/**
 * Destination photo that never leaves an empty box: if the image is missing or fails to load,
 * an on-brand gradient with the place name is shown instead. Wikimedia photos are served directly
 * at a fitting thumbnail size (no image-optimisation quota is used).
 */
export function SafeImage({
  src,
  alt,
  slot,
  title,
  subtitle,
  priority = false,
  sizes,
  fallbacks = [],
}: {
  src: string | null | undefined;
  /** Other photos to try, in order, before showing the branded placeholder. */
  fallbacks?: string[];
  alt: string;
  slot: "thumb" | "card" | "hero";
  title: string;
  subtitle?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const candidates = [src, ...fallbacks].filter((u): u is string => Boolean(u));
  const [attempt, setAttempt] = useState(0);
  const current = candidates[attempt];
  if (!current) {
    return (
      <div className="img-fallback" role="img" aria-label={alt || title}>
        <div>
          <span>{title}</span>
          {subtitle ? <small>{subtitle}</small> : null}
        </div>
      </div>
    );
  }
  const url = sizedUrl(current, slot);
  return (
    <Image
      src={url}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes ?? (slot === "hero" ? "100vw" : slot === "card" ? "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 25vw" : "200px")}
      unoptimized={isWikimedia(url)}
      key={url}
      onError={() => setAttempt((a) => a + 1)}
      style={{ objectFit: "cover" }}
    />
  );
}
