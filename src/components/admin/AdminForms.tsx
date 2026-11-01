"use client";

import { useActionState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { FormMessage, SubmitButton } from "@/components/ui/Form";
import type { ActionState } from "@/lib/validation";
import { saveDestinationAction, saveHeroSlideAction, savePlaceAction, savePlanAction, saveTranslationAction, heroSlideCommandAction, placeCommandAction, moderatePostAction, moderateReviewAction, userCommandAction, markContactHandledAction } from "@/actions/admin";

const ACTIONS = {
  hero: saveHeroSlideAction,
  destination: saveDestinationAction,
  place: savePlaceAction,
  plan: savePlanAction,
  translation: saveTranslationAction,
} as const;

/** Generic admin form: fields are rendered by the server page; errors are listed by field name. */
export function AdminForm({ kind, children, submitLabel }: { kind: keyof typeof ACTIONS; children: ReactNode; submitLabel: string }) {
  const [state, action] = useActionState(ACTIONS[kind], { ok: false } as ActionState);
  const t = useTranslations("admin");
  return (
    <form action={action} className="form card">
      <FormMessage state={state} />
      {state.errors ? (
        <p className="field-error" role="alert">
          {t("invalidFields")}: {Object.keys(state.errors).join(", ")}
        </p>
      ) : null}
      {children}
      <div><SubmitButton>{submitLabel}</SubmitButton></div>
    </form>
  );
}

type Cmd =
  | { type: "hero"; id: string; command: "up" | "down" | "toggle" | "delete" }
  | { type: "place"; id: string; command: "verify" | "unverify" | "delete" }
  | { type: "post"; id: string; command: "published" | "hidden" | "removed" }
  | { type: "review"; id: string; command: "published" | "hidden" }
  | { type: "user"; id: string; command: "make_admin" | "make_user" | "suspend" | "activate" }
  | { type: "contact"; id: string; command: "handled" };

export function CommandButton({ cmd, label, danger = false, confirmText }: { cmd: Cmd; label: string; danger?: boolean; confirmText?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={`btn btn--sm ${danger ? "btn--danger" : ""}`}
      disabled={pending}
      onClick={() => {
        if (confirmText && !confirm(confirmText)) return;
        start(async () => {
          if (cmd.type === "hero") await heroSlideCommandAction(cmd.id, cmd.command);
          if (cmd.type === "place") await placeCommandAction(cmd.id, cmd.command);
          if (cmd.type === "post") await moderatePostAction(cmd.id, cmd.command);
          if (cmd.type === "review") await moderateReviewAction(cmd.id, cmd.command);
          if (cmd.type === "user") await userCommandAction(cmd.id, cmd.command);
          if (cmd.type === "contact") await markContactHandledAction(cmd.id);
        });
      }}
    >
      {pending ? <span className="spinner" aria-hidden /> : null}
      {label}
    </button>
  );
}
