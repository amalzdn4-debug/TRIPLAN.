"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");
  useEffect(() => console.error(error), [error]);
  return (
    <section className="section" style={{ paddingBlockStart: "calc(var(--header-h) + 6rem)" }}>
      <div className="container container--narrow empty">
        <h1>{t("title")}</h1>
        <p className="lead">{t("body")}</p>
        <button type="button" className="btn btn--primary" onClick={reset}>
          {t("retry")}
        </button>
      </div>
    </section>
  );
}
