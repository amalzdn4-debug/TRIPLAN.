"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { FormMessage, SubmitButton } from "@/components/ui/Form";
import type { ActionState } from "@/lib/validation";
import { saveDestinationAction, saveHeroSlideAction, savePlaceAction, savePlanAction, saveTranslationAction, heroSlideCommandAction, placeCommandAction, moderatePostAction, moderateCommentAction, affiliateCommandAction, saveAffiliateAction, moderateReviewAction, userCommandAction, markContactHandledAction, enrichContentAction, type EnrichResult } from "@/actions/admin";

const ACTIONS = {
  hero: saveHeroSlideAction,
  destination: saveDestinationAction,
  place: savePlaceAction,
  plan: savePlanAction,
  translation: saveTranslationAction,
  affiliate: saveAffiliateAction,
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
          {t("invalidFields")}: {Object.entries(state.errors).map(([k, v]) => (v && v !== "invalid" && v !== "required" ? `${k} (${v})` : k)).join(", ")}
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
  | { type: "user"; id: string; command: "make_admin" | "make_user" | "suspend" | "activate" | "verify_email" }
  | { type: "contact"; id: string; command: "handled" }
  | { type: "enrich"; id: string; command: "reimport" }
  | { type: "comment"; id: string; command: "published" | "hidden" | "removed" }
  | { type: "affiliate"; id: string; command: "approved" | "paused" | "rejected" | "pending" | "delete" };

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
          if (cmd.type === "comment") await moderateCommentAction(cmd.id, cmd.command);
          if (cmd.type === "affiliate") await affiliateCommandAction(cmd.id, cmd.command);
          if (cmd.type === "user") await userCommandAction(cmd.id, cmd.command);
          if (cmd.type === "contact") await markContactHandledAction(cmd.id);
          if (cmd.type === "enrich") await enrichContentAction(cmd.id);
        });
      }}
    >
      {pending ? <span className="spinner" aria-hidden /> : null}
      {label}
    </button>
  );
}

/** Runs the content import in ~40-second batches and reports progress. */
export function EnrichPanel({ pending, done, partial, failed }: { pending: number; done: number; partial: number; failed: number }) {
  const t = useTranslations("admin");
  const [busy, start] = useTransition();
  const [result, setResult] = useState<EnrichResult | null>(null);
  return (
    <div className="card stack">
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("enrich.title")}</h2>
      <p className="small muted">{t("enrich.body")}</p>
      <p className="cluster">
        <span className="badge badge--blue">{t("enrich.done", { n: done })}</span>
        <span className="badge">{t("enrich.partial", { n: partial })}</span>
        <span className="badge badge--alert">{t("enrich.failed", { n: failed })}</span>
        <span className="badge badge--outline">{t("enrich.pending", { n: result ? result.remaining : pending })}</span>
      </p>
      <div>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => start(async () => setResult(await enrichContentAction()))}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          {busy ? t("enrich.running") : t("enrich.run")}
        </button>
      </div>
      {result ? (
        <p className="small" role="status">
          {result.ok ? t("enrich.result", { processed: result.processed, done: result.done, failed: result.failed, remaining: result.remaining }) : result.message}
        </p>
      ) : null}
      {result?.errors.length ? (
        <ul className="small muted">{result.errors.slice(0, 10).map((e) => <li key={e.slug}><strong>{e.slug}</strong>: {e.error}</li>)}</ul>
      ) : null}
    </div>
  );
}
