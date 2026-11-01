"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { Icon } from "./Icon";
import type { ActionState } from "@/lib/validation";

export function SubmitButton({ children, className = "btn btn--primary", pendingLabel, disabled }: { children: ReactNode; className?: string; pendingLabel?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending}>
      {pending ? <span className="spinner" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** Translated error for a field (keys under "errors.*"). */
export function useFieldError(state: ActionState | undefined) {
  const te = useTranslations("errors");
  return (name: string) => {
    const key = state?.errors?.[name];
    return key ? (te.has(key) ? te(key) : te("invalid")) : undefined;
  };
}

export function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; name: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, name, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint ? (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={`${id}-err`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ state }: { state: ActionState | undefined }) {
  const ts = useTranslations("status");
  if (!state?.message) return null;
  const tone = state.ok ? "alert--success" : "alert--danger";
  return (
    <div className={`alert ${tone}`} role={state.ok ? "status" : "alert"}>
      <Icon name={state.ok ? "check" : "alert"} />
      <p>{ts.has(state.message) ? ts(state.message) : ts("genericError")}</p>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "danger"; children: ReactNode }) {
  return (
    <div className={`alert ${tone === "info" ? "" : `alert--${tone}`}`}>
      <Icon name={tone === "warning" || tone === "danger" ? "alert" : tone === "success" ? "check" : "info"} />
      <div>{children}</div>
    </div>
  );
}
