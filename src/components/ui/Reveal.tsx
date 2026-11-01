"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

/** Subtle fade/rise when scrolled into view. Disabled automatically for reduced-motion users (CSS). */
export function Reveal({ children, as: Tag = "div", index = 0, className = "", style, ...rest }: { children: ReactNode; as?: ElementType; index?: number; className?: string; style?: React.CSSProperties; [k: string]: unknown }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("is-visible");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ ...style, ["--reveal-i" as string]: index }} {...rest}>
      {children}
    </Tag>
  );
}
