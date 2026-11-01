"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Field, FormMessage, SubmitButton, useFieldError } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { forgotPasswordAction, loginAction, resetPasswordAction, signupAction } from "@/actions/auth";
import type { ActionState } from "@/lib/validation";

const initial: ActionState = { ok: false };

function GoogleButton({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const href = `/api/auth/google?locale=${locale}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  return (
    <>
      <a className="btn btn--block" href={href}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 01-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0012 23z" />
          <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 010-4.2V7.1H2.2a11 11 0 000 9.8l3.6-2.8z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 002.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
        </svg>
        {t("google")}
      </a>
      <div className="divider">{t("or")}</div>
    </>
  );
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const t = useTranslations("auth");
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input {...props} type={show ? "text" : "password"} className="input" style={{ paddingInlineEnd: 56 }} />
      <button type="button" className="btn btn--ghost btn--sm" style={{ position: "absolute", insetInlineEnd: 4, insetBlockStart: 6 }} onClick={() => setShow((s) => !s)} aria-pressed={show}>
        {show ? t("hide") : t("show")}
      </button>
    </div>
  );
}

export function LoginForm({ next, google, oauthError }: { next?: string; google: boolean; oauthError?: boolean }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(loginAction, initial);
  const err = useFieldError(state);
  return (
    <div className="stack">
      <h1>{t("loginTitle")}</h1>
      <p className="muted">{next?.startsWith("/plan") ? t("loginToPlan") : t("loginLead")}</p>
      {oauthError ? <FormMessage state={{ ok: false, message: "oauthFailed" }} /> : null}
      {google ? <GoogleButton next={next} /> : null}
      <form action={action} className="form" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <FormMessage state={state} />
        <Field label={t("email")} name="email" error={err("email")}>
          {(p) => <input {...p} className="input ltr" type="email" autoComplete="email" inputMode="email" required defaultValue={(state.values?.email as string) ?? ""} />}
        </Field>
        <Field label={t("password")} name="password" error={err("password")}>
          {(p) => <PasswordInput {...p} autoComplete="current-password" required />}
        </Field>
        <div className="cluster" style={{ justifyContent: "flex-end" }}>
          <Link href="/forgot-password" className="small">
            {t("forgot")}
          </Link>
        </div>
        <SubmitButton className="btn btn--primary btn--lg btn--block">{t("loginCta")}</SubmitButton>
      </form>
      <p className="small muted" style={{ textAlign: "center" }}>
        {t("noAccount")} <Link href={{ pathname: "/signup", query: next ? { next } : {} }}>{t("signupLink")}</Link>
      </p>
    </div>
  );
}

export function SignupForm({ next, google }: { next?: string; google: boolean }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(signupAction, initial);
  const err = useFieldError(state);
  return (
    <div className="stack">
      <h1>{t("signupTitle")}</h1>
      <p className="muted">{t("signupLead")}</p>
      {google ? <GoogleButton next={next} /> : null}
      <form action={action} className="form" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <FormMessage state={state} />
        <Field label={t("name")} name="name" error={err("name")}>
          {(p) => <input {...p} className="input" autoComplete="name" required defaultValue={(state.values?.name as string) ?? ""} />}
        </Field>
        <Field label={t("email")} name="email" error={err("email")}>
          {(p) => <input {...p} className="input ltr" type="email" autoComplete="email" inputMode="email" required defaultValue={(state.values?.email as string) ?? ""} />}
        </Field>
        <Field label={t("password")} name="password" error={err("password")} hint={t("passwordHint")}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" required minLength={10} />}
        </Field>
        <Field label={t("confirmPassword")} name="confirm" error={err("confirm")}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" required />}
        </Field>
        <div className="field">
          <label className="checkbox">
            <input type="checkbox" name="terms" required aria-invalid={err("terms") ? true : undefined} />
            <span>
              {t.rich("agree", {
                terms: (c) => <Link href="/legal/terms">{c}</Link>,
                privacy: (c) => <Link href="/legal/privacy">{c}</Link>,
              })}
            </span>
          </label>
          {err("terms") ? <p className="field-error">{err("terms")}</p> : null}
        </div>
        <SubmitButton className="btn btn--primary btn--lg btn--block">{t("signupCta")}</SubmitButton>
      </form>
      <p className="small muted" style={{ textAlign: "center" }}>
        {t("haveAccount")} <Link href={{ pathname: "/login", query: next ? { next } : {} }}>{t("loginLink")}</Link>
      </p>
    </div>
  );
}

export function ForgotForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState(forgotPasswordAction, initial);
  const err = useFieldError(state);
  return (
    <div className="stack">
      <h1>{t("forgotTitle")}</h1>
      <p className="muted">{t("forgotLead")}</p>
      <form action={action} className="form" noValidate>
        <FormMessage state={state} />
        <Field label={t("email")} name="email" error={err("email")}>
          {(p) => <input {...p} className="input ltr" type="email" autoComplete="email" required />}
        </Field>
        <SubmitButton className="btn btn--primary btn--lg btn--block">{t("forgotCta")}</SubmitButton>
      </form>
      <Link href="/login" className="small">
        <Icon name="arrowLeft" className="flip-rtl" style={{ display: "inline", inlineSize: 14, verticalAlign: -2 }} /> {t("backToLogin")}
      </Link>
    </div>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(resetPasswordAction, initial);
  const err = useFieldError(state);
  return (
    <div className="stack">
      <h1>{t("resetTitle")}</h1>
      <form action={action} className="form" noValidate>
        <input type="hidden" name="token" value={token} />
        <FormMessage state={state} />
        <Field label={t("newPassword")} name="password" error={err("password")} hint={t("passwordHint")}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" required />}
        </Field>
        <Field label={t("confirmPassword")} name="confirm" error={err("confirm")}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" required />}
        </Field>
        <SubmitButton className="btn btn--primary btn--lg btn--block">{t("resetCta")}</SubmitButton>
      </form>
    </div>
  );
}
