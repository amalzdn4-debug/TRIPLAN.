import Image from "next/image";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { DEFAULT_HERO_SLIDES } from "@/data/hero";

export async function AuthShell({ children, slide = 0 }: { children: ReactNode; slide?: number }) {
  const t = await getTranslations("auth");
  const s = DEFAULT_HERO_SLIDES[slide % DEFAULT_HERO_SLIDES.length];
  return (
    <div className="auth-page">
      <aside className="auth-visual" aria-hidden>
        <Image src={s.imageUrl} alt="" fill sizes="50vw" style={{ objectFit: "cover" }} />
        <div className="auth-visual__content">
          <span className="eyebrow">{t("visualEyebrow")}</span>
          <h2>{t("visualTitle")}</h2>
          <p style={{ opacity: 0.85 }}>{s.city}</p>
        </div>
      </aside>
      <div className="auth-panel">
        <div className="auth-panel__inner">{children}</div>
      </div>
    </div>
  );
}
