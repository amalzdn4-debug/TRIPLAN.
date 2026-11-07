"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { resendVerificationAction } from "@/actions/auth";

/**
 * `available` is false when the site has no email provider configured.
 * Then we say so plainly and point to the contact page, instead of
 * offering a button that cannot deliver anything.
 */
export function ResendVerification({ available = true }: { available?: boolean }) {
  const t = useTranslations("status");
  const tc = useTranslations("common");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!available) {
    return (
      <span>
        {t("verifyManual")} <Link href="/contact">{tc("contactUs")}</Link>
      </span>
    );
  }
  if (msg) return <strong>{t.has(msg) ? t(msg) : msg}</strong>;
  return (
    <button type="button" className="link-btn" disabled={pending} onClick={() => start(async () => setMsg((await resendVerificationAction()).message ?? "verificationSent"))}>
      {tc("resendVerification")}
    </button>
  );
}
