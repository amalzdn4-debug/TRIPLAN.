"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, LOCALE_META, type Locale } from "@/config/locales";
import { Dropdown } from "@/components/ui/Dropdown";
import { Icon } from "@/components/ui/Icon";
import { saveLanguagePreferenceAction } from "@/actions/account";

export function LanguageSelector({ signedIn = false, compact = false }: { signedIn?: boolean; compact?: boolean }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    // Planner forms persist their drafts in sessionStorage, so switching language never loses input.
    window.dispatchEvent(new Event("triplan:before-locale-change"));
    const search = typeof window !== "undefined" ? window.location.search : "";
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    startTransition(() => {
      router.replace(`${pathname}${search}${hash}`, { locale: next, scroll: false });
    });
    if (signedIn) void saveLanguagePreferenceAction(next);
  }

  return (
    <Dropdown
      label={t("language")}
      trigger={
        <>
          <Icon name="globe" />
          <span className="ltr" lang={LOCALE_META[locale].htmlLang}>{compact ? locale.toUpperCase() : LOCALE_META[locale].nativeName}</span>
          {pending ? <span className="spinner" aria-hidden /> : <Icon name="chevronDown" />}
        </>
      }
    >
      {(close) => (
        <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {LOCALES.map((l) => (
            <li key={l}>
              <button
                type="button"
                lang={LOCALE_META[l].htmlLang}
                dir={LOCALE_META[l].dir}
                aria-current={l === locale ? "true" : undefined}
                onClick={() => {
                  close();
                  choose(l);
                }}
              >
                <span style={{ flex: 1 }}>{LOCALE_META[l].nativeName}</span>
                {l === locale ? <Icon name="check" /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dropdown>
  );
}
