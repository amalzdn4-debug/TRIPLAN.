import "server-only";
import { getTranslations } from "next-intl/server";
import { siteUrl } from "@/config/site";
import { features } from "@/lib/env";
import { dirOf } from "@/config/locales";

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function send(mail: Mail): Promise<void> {
  if (!features.email()) {
    // Development fallback: print instead of sending. Never silently claims success in production.
    console.info(`\n[email:dev] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
    if (process.env.NODE_ENV === "production") console.warn("[email] RESEND_API_KEY not configured — email not delivered.");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (!res.ok) console.error("[email] send failed", res.status, await res.text().catch(() => ""));
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(locale: string, heading: string, body: string, cta?: { label: string; url: string }, footer?: string) {
  const dir = dirOf(locale);
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.url}" style="background:#173B67;color:#FFFFFF;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(cta.label)}</a></p>
       <p style="font-size:12px;color:#5f6b7c;word-break:break-all" dir="ltr">${cta.url}</p>`
    : "";
  return `<!doctype html><html lang="${locale}" dir="${dir}"><body style="margin:0;background:#FFFFFF;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#111">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <img src="${siteUrl()}/brand/triplan-lockup-teal.svg" alt="TRIPLAN" width="160" style="display:block;margin-bottom:28px"/>
    <div style="background:#fff;border-radius:16px;padding:28px">
      <h1 style="color:#173B67;font-size:22px;margin:0 0 12px">${escapeHtml(heading)}</h1>
      <p style="line-height:1.6;margin:0">${escapeHtml(body)}</p>
      ${button}
    </div>
    <p style="font-size:12px;color:#5f6b7c;margin-top:20px">${escapeHtml(footer ?? "")}</p>
  </div></body></html>`;
}

export async function sendVerificationEmail(to: string, token: string, locale: string) {
  const t = await getTranslations({ locale, namespace: "email" });
  const url = `${siteUrl()}/${locale}/verify-email?token=${encodeURIComponent(token)}`;
  await send({
    to,
    subject: t("verify.subject"),
    html: layout(locale, t("verify.heading"), t("verify.body"), { label: t("verify.cta"), url }, t("footer")),
    text: `${t("verify.heading")}\n\n${t("verify.body")}\n\n${url}`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string, locale: string) {
  const t = await getTranslations({ locale, namespace: "email" });
  const url = `${siteUrl()}/${locale}/reset-password?token=${encodeURIComponent(token)}`;
  await send({
    to,
    subject: t("reset.subject"),
    html: layout(locale, t("reset.heading"), t("reset.body"), { label: t("reset.cta"), url }, t("footer")),
    text: `${t("reset.heading")}\n\n${t("reset.body")}\n\n${url}`,
  });
}

export async function sendContactNotification(fields: { name: string; email: string; topic: string; message: string }) {
  const inbox = process.env.CONTACT_INBOX;
  if (!inbox) return;
  await send({
    to: inbox,
    subject: `[Triplan contact] ${fields.topic} — ${fields.name}`,
    html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(`${fields.name} <${fields.email}>\n\n${fields.message}`)}</pre>`,
    text: `${fields.name} <${fields.email}>\n\n${fields.message}`,
  });
}
