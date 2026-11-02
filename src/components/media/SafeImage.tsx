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
}: {
  src: string | null | undefined;
  alt: string;
  slot: "thumb" | "card" | "hero";
  title: string;
  subtitle?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="img-fallback" role="img" aria-label={alt || title}>
        <div>
          <span>{title}</span>
          {subtitle ? <small>{subtitle}</small> : null}
        </div>
      </div>
    );
  }
  const url = sizedUrl(src, slot);
  return (
    <Image
      src={url}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes ?? (slot === "hero" ? "100vw" : slot === "card" ? "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 25vw" : "200px")}
      unoptimized={isWikimedia(url)}
      onError={() => setFailed(true)}
      style={{ objectFit: "cover" }}
    />
  );
}
