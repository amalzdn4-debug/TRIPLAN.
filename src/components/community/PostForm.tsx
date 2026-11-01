"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createPostAction } from "@/actions/community";
import { Field, FormMessage, SubmitButton, useFieldError } from "@/components/ui/Form";
import type { ActionState } from "@/lib/validation";

const TYPES = ["recommendation", "hidden_gem", "review", "restaurant", "tip"] as const;

export function PostForm({ destinations, defaultDestination }: { destinations: { slug: string; label: string }[]; defaultDestination?: string }) {
  const t = useTranslations("community");
  const [state, action] = useActionState(createPostAction, { ok: false } as ActionState);
  const err = useFieldError(state);
  const [type, setType] = useState<string>((state.values?.type as string) ?? "recommendation");
  return (
    <form action={action} className="form card" id="share" key={state.ok ? "done" : "form"}>
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("shareTitle")}</h2>
      <p className="small muted">{t("shareRules")}</p>
      <FormMessage state={state} />
      <div className="form-row">
        <Field label={t("destination")} name="destinationSlug" error={err("destinationSlug")}>
          {(p) => (
            <select {...p} className="select" defaultValue={(state.values?.destinationSlug as string) ?? defaultDestination ?? ""}>
              <option value="">{t("chooseDestination")}</option>
              {destinations.map((d) => <option key={d.slug} value={d.slug}>{d.label}</option>)}
            </select>
          )}
        </Field>
        <Field label={t("type")} name="type" error={err("type")}>
          {(p) => (
            <select {...p} className="select" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((x) => <option key={x} value={x}>{t(`types.${x}`)}</option>)}
            </select>
          )}
        </Field>
        {type === "review" ? (
          <Field label={t("rating")} name="rating" error={err("rating")}>
            {(p) => (
              <select {...p} className="select" defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
              </select>
            )}
          </Field>
        ) : null}
      </div>
      <Field label={t("postTitle")} name="title" error={err("title")}>
        {(p) => <input {...p} className="input" maxLength={140} defaultValue={(state.values?.title as string) ?? ""} />}
      </Field>
      <Field label={t("body")} name="body" error={err("body")} hint={t("bodyHint")}>
        {(p) => <textarea {...p} className="textarea" maxLength={4000} defaultValue={(state.values?.body as string) ?? ""} />}
      </Field>
      <div><SubmitButton>{t("publish")}</SubmitButton></div>
    </form>
  );
}
