"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormMessage, SubmitButton, useFieldError } from "@/components/ui/Form";
import { changePasswordAction, deleteAccountAction, updatePreferencesAction, updateProfileAction } from "@/actions/account";
import { LOCALES, LOCALE_META } from "@/config/locales";
import { CURRENCIES } from "@/components/planner/shared";
import type { ActionState } from "@/lib/validation";

const init: ActionState = { ok: false };

export function ProfileForm({ profile }: { profile: { displayName: string; homeCity: string; bio: string } }) {
  const t = useTranslations("account");
  const [state, action] = useActionState(updateProfileAction, init);
  const err = useFieldError(state);
  return (
    <form action={action} className="form card">
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("profile")}</h2>
      <FormMessage state={state} />
      <div className="form-row">
        <Field label={t("displayName")} name="displayName" error={err("displayName")}>
          {(p) => <input {...p} className="input" defaultValue={profile.displayName} required maxLength={80} />}
        </Field>
        <Field label={t("homeCity")} name="homeCity" error={err("homeCity")}>
          {(p) => <input {...p} className="input" defaultValue={profile.homeCity} maxLength={120} />}
        </Field>
      </div>
      <Field label={t("bio")} name="bio" error={err("bio")}>
        {(p) => <textarea {...p} className="textarea" defaultValue={profile.bio} maxLength={500} />}
      </Field>
      <div><SubmitButton>{t("save")}</SubmitButton></div>
    </form>
  );
}

export function PreferencesForm({ prefs }: { prefs: { locale: string; currency: string; units: string; timeFormat: string; marketingEmails: boolean } }) {
  const t = useTranslations("account");
  const [state, action] = useActionState(updatePreferencesAction, init);
  const err = useFieldError(state);
  return (
    <form action={action} className="form card">
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("preferences")}</h2>
      <FormMessage state={state} />
      <div className="form-row">
        <Field label={t("language")} name="locale" error={err("locale")}>
          {(p) => (
            <select {...p} className="select" defaultValue={prefs.locale}>
              {LOCALES.map((l) => <option key={l} value={l} lang={LOCALE_META[l].htmlLang}>{LOCALE_META[l].nativeName}</option>)}
            </select>
          )}
        </Field>
        <Field label={t("currency")} name="currency" error={err("currency")}>
          {(p) => (
            <select {...p} className="select" defaultValue={prefs.currency}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </Field>
        <Field label={t("units")} name="units" error={err("units")}>
          {(p) => (
            <select {...p} className="select" defaultValue={prefs.units}>
              <option value="metric">{t("metric")}</option>
              <option value="imperial">{t("imperial")}</option>
            </select>
          )}
        </Field>
        <Field label={t("timeFormat")} name="timeFormat" error={err("timeFormat")}>
          {(p) => (
            <select {...p} className="select" defaultValue={prefs.timeFormat}>
              <option value="auto">{t("timeAuto")}</option>
              <option value="24h">24h</option>
              <option value="12h">12h</option>
            </select>
          )}
        </Field>
      </div>
      <label className="checkbox">
        <input type="checkbox" name="marketingEmails" defaultChecked={prefs.marketingEmails} />
        <span>{t("marketing")}</span>
      </label>
      <div><SubmitButton>{t("save")}</SubmitButton></div>
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("account");
  const [state, action] = useActionState(changePasswordAction, init);
  const err = useFieldError(state);
  return (
    <form action={action} className="form card">
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{hasPassword ? t("changePassword") : t("setPassword")}</h2>
      <FormMessage state={state} />
      {hasPassword ? (
        <Field label={t("currentPassword")} name="currentPassword" error={err("currentPassword")}>
          {(p) => <input {...p} className="input" type="password" autoComplete="current-password" />}
        </Field>
      ) : null}
      <div className="form-row">
        <Field label={t("newPassword")} name="newPassword" error={err("newPassword")}>
          {(p) => <input {...p} className="input" type="password" autoComplete="new-password" minLength={10} />}
        </Field>
        <Field label={t("confirmPassword")} name="confirm" error={err("confirm")}>
          {(p) => <input {...p} className="input" type="password" autoComplete="new-password" />}
        </Field>
      </div>
      <div><SubmitButton>{t("updatePassword")}</SubmitButton></div>
    </form>
  );
}

export function DeleteAccountForm({ email }: { email: string }) {
  const t = useTranslations("account");
  const [state, action] = useActionState(deleteAccountAction, init);
  const err = useFieldError(state);
  return (
    <form action={action} className="form card" style={{ borderColor: "#e6b9ad" }}>
      <h2 style={{ fontSize: "var(--fs-lg)", color: "var(--color-danger)" }}>{t("deleteTitle")}</h2>
      <p className="small muted">{t("deleteBody")}</p>
      <FormMessage state={state} />
      <Field label={t("deleteConfirm", { email })} name="confirm" error={err("confirm")}>
        {(p) => <input {...p} className="input ltr" autoComplete="off" />}
      </Field>
      <div><SubmitButton className="btn btn--danger">{t("deleteCta")}</SubmitButton></div>
    </form>
  );
}
