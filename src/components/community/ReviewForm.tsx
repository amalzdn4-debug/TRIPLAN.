"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createReviewAction } from "@/actions/community";
import { Field, FormMessage, SubmitButton, useFieldError } from "@/components/ui/Form";
import type { ActionState } from "@/lib/validation";

export function ReviewForm() {
  const t = useTranslations("reviews");
  const [state, action] = useActionState(createReviewAction, { ok: false } as ActionState);
  const err = useFieldError(state);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="form card">
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("formTitle")}</h2>
      <FormMessage state={state} />
      <Field label={t("rating")} name="rating" error={err("rating")}>
        {(p) => (
          <select {...p} className="select" defaultValue="5">
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n}/5)</option>)}
          </select>
        )}
      </Field>
      <Field label={t("body")} name="body" error={err("body")}>
        {(p) => <textarea {...p} className="textarea" maxLength={2000} />}
      </Field>
      <p className="small muted">{t("moderated")}</p>
      <div><SubmitButton>{t("submit")}</SubmitButton></div>
    </form>
  );
}
