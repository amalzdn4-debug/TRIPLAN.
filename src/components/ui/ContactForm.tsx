"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { contactAction } from "@/actions/contact";
import { Field, FormMessage, SubmitButton, useFieldError } from "./Form";
import type { ActionState } from "@/lib/validation";

export function ContactForm({ defaults }: { defaults?: { name?: string; email?: string } }) {
  const t = useTranslations("contact");
  const [state, action] = useActionState(contactAction, { ok: false } as ActionState);
  const err = useFieldError(state);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="form card" noValidate>
      <FormMessage state={state} />
      <div className="form-row">
        <Field label={t("name")} name="name" error={err("name")}>
          {(p) => <input {...p} className="input" autoComplete="name" defaultValue={(state.values?.name as string) ?? defaults?.name ?? ""} />}
        </Field>
        <Field label={t("email")} name="email" error={err("email")}>
          {(p) => <input {...p} className="input ltr" type="email" autoComplete="email" defaultValue={(state.values?.email as string) ?? defaults?.email ?? ""} />}
        </Field>
      </div>
      <Field label={t("topic")} name="topic" error={err("topic")}>
        {(p) => (
          <select {...p} className="select" defaultValue={(state.values?.topic as string) ?? "general"}>
            {["general", "account", "billing", "partnership", "press", "privacy"].map((x) => <option key={x} value={x}>{t(`topics.${x}`)}</option>)}
          </select>
        )}
      </Field>
      <Field label={t("message")} name="message" error={err("message")}>
        {(p) => <textarea {...p} className="textarea" maxLength={5000} style={{ minBlockSize: 160 }} defaultValue={(state.values?.message as string) ?? ""} />}
      </Field>
      {/* Honeypot: hidden from people, tempting for bots */}
      <div aria-hidden style={{ position: "absolute", insetInlineStart: -9999 }}>
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <p className="small muted">{t("privacy")}</p>
      <div><SubmitButton>{t("send")}</SubmitButton></div>
    </form>
  );
}
