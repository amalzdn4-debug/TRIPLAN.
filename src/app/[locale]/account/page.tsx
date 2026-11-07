import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guards";
import { getDb, schema } from "@/db";
import { AccountNav } from "@/components/account/AccountNav";
import { DeleteAccountForm, PasswordForm, PreferencesForm, ProfileForm } from "@/components/account/AccountForms";
import { Notice } from "@/components/ui/Form";
import { features } from "@/lib/env";
import { ResendVerification } from "@/components/account/ResendVerification";
import { Icon } from "@/components/ui/Icon";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("title"), robots: { index: false } };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser("/account");
  const t = await getTranslations("account");
  const db = await getDb();
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id));
  const [prefs] = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, user.id));
  const [row] = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, user.id));
  return (
    <section className="section" style={{ paddingBlockStart: "calc(var(--header-h) + 2.5rem)" }}>
      <div className="container dash-layout">
        <AccountNav current="/account" isAdmin={user.role === "admin"} />
        <div className="stack" style={{ gap: 24 }}>
          <div>
            <h1 style={{ fontSize: "var(--fs-2xl)" }}>{t("title")}</h1>
            <p className="muted"><span className="ltr">{user.email}</span> · {user.emailVerified ? t("verified") : t("unverified")}</p>
            <p className="small" style={{ margin: 0 }}><Link href={`/community/members/${user.id}`}>{t("viewPublicProfile")}</Link> · <span className="muted">{t("publicProfileNote")}</span></p>
          </div>
          {!user.emailVerified ? <Notice tone="warning">{t("verifyPrompt")} <ResendVerification available={features.emailDelivery()} /></Notice> : null}
          <ProfileForm profile={{ displayName: profile?.displayName ?? user.displayName, homeCity: profile?.homeCity ?? "", bio: profile?.bio ?? "" }} />
          <PreferencesForm prefs={{ locale: prefs?.locale ?? locale, currency: prefs?.currency ?? "EUR", units: prefs?.units ?? "metric", timeFormat: prefs?.timeFormat ?? "auto", marketingEmails: prefs?.marketingEmails ?? false }} />
          <PasswordForm hasPassword={Boolean(row?.hash)} />
          <div className="card stack">
            <h2 style={{ fontSize: "var(--fs-lg)" }}>{t("privacyTitle")}</h2>
            <p className="small muted">{t("privacyBody")}</p>
            <a className="btn" href="/api/account/export" download style={{ justifySelf: "start" }}>
              <Icon name="external" />
              {t("export")}
            </a>
          </div>
          <DeleteAccountForm email={user.email} />
        </div>
      </div>
    </section>
  );
}
