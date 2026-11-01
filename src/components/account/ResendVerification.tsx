"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { resendVerificationAction } from "@/actions/auth";

export function ResendVerification() {
  const t = useTranslations("status");
  const tc = useTranslations("common");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (msg) return <strong>{t.has(msg) ? t(msg) : msg}</strong>;
  return (
    <button type="button" className="link-btn" disabled={pending} onClick={() => start(async () => setMsg((await resendVerificationAction()).message ?? "verificationSent"))}>
      {tc("resendVerification")}
    </button>
  );
}
