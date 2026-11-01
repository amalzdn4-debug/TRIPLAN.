"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const KEY = "tp_consent";
type Consent = { necessary: true; analytics: boolean; ts: number };

function read(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Consent) : null;
  } catch {
    return null;
  }
}

function write(analytics: boolean) {
  const value: Consent = { necessary: true, analytics, ts: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
  document.cookie = `${KEY}=${analytics ? "all" : "necessary"}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
  window.dispatchEvent(new CustomEvent("triplan:consent", { detail: value }));
}

/**
 * Triplan only sets strictly necessary cookies (session, language, this choice). No analytics
 * scripts ship by default; if you add any, load them only when consent.analytics === true.
 */
export function CookieConsent() {
  const t = useTranslations("cookie");
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  useEffect(() => {
    if (!read()) setOpen(true);
    const reopen = () => {
      setAnalytics(read()?.analytics ?? false);
      setDetails(true);
      setOpen(true);
    };
    window.addEventListener("triplan:open-cookie-settings", reopen);
    return () => window.removeEventListener("triplan:open-cookie-settings", reopen);
  }, []);
  if (!open) return null;
  const done = (a: boolean) => {
    write(a);
    setOpen(false);
  };
  return (
    <section className="cookie-banner" role="dialog" aria-labelledby="cookie-title" aria-live="polite">
      <h2 id="cookie-title">{t("title")}</h2>
      <p>
        {t("body")} <Link href="/legal/cookies">{t("learnMore")}</Link>
      </p>
      {details ? (
        <div className="stack" style={{ marginBlockEnd: 16 }}>
          <label className="checkbox">
            <input type="checkbox" checked disabled />
            <span>
              <strong>{t("necessary")}</strong> — {t("necessaryHint")}
            </span>
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
            <span>
              <strong>{t("analytics")}</strong> — {t("analyticsHint")}
            </span>
          </label>
        </div>
      ) : null}
      <div className="cluster">
        <button type="button" className="btn btn--primary btn--sm" onClick={() => done(true)}>
          {t("acceptAll")}
        </button>
        <button type="button" className="btn btn--sm" onClick={() => done(false)}>
          {t("necessaryOnly")}
        </button>
        {details ? (
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => done(analytics)}>
            {t("save")}
          </button>
        ) : (
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setDetails(true)}>
            {t("customize")}
          </button>
        )}
      </div>
    </section>
  );
}

export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button type="button" className="link-btn" style={{ color: "inherit", textDecoration: "none" }} onClick={() => window.dispatchEvent(new Event("triplan:open-cookie-settings"))}>
      {label}
    </button>
  );
}
