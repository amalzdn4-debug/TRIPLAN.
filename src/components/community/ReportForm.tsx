"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export const REPORT_REASONS = ["spam", "offensive", "misleading", "unsafe", "other"] as const;

export function ReportForm({ id, onSend, onCancel, pending }: { id: string; onSend: (reason: string, details: string) => void; onCancel: () => void; pending: boolean }) {
  const t = useTranslations("community");
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  return (
    <form
      className="form card card--muted card--flat"
      style={{ padding: 16 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSend(reason, details);
      }}
    >
      <div className="field">
        <label htmlFor={`reason-${id}`}>{t("reportReason")}</label>
        <select id={`reason-${id}`} className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REPORT_REASONS.map((r) => <option key={r} value={r}>{t(`reasons.${r}`)}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`details-${id}`}>{t("reportDetails")}</label>
        <textarea id={`details-${id}`} className="textarea" maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} style={{ minBlockSize: 80 }} />
      </div>
      <div className="cluster">
        <button type="submit" className="btn btn--sm btn--primary" disabled={pending}>{t("sendReport")}</button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={onCancel}>{t("cancel")}</button>
      </div>
    </form>
  );
}
