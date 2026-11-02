import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";

const ITEMS = [
  { href: "/admin", key: "dashboard", icon: "home" },
  { href: "/admin/hero", key: "hero", icon: "sparkles" },
  { href: "/admin/destinations", key: "destinations", icon: "pin" },
  { href: "/admin/moderation", key: "moderation", icon: "flag" },
  { href: "/admin/users", key: "users", icon: "users" },
  { href: "/admin/pricing", key: "pricing", icon: "wallet" },
  { href: "/admin/affiliates", key: "affiliates", icon: "external" },
  { href: "/admin/translations", key: "translations", icon: "globe" },
] as const;

export async function AdminShell({ current, title, children }: { current: string; title: string; children: ReactNode }) {
  const t = await getTranslations("admin");
  return (
    <section className="section" style={{ paddingBlockStart: "calc(var(--header-h) + 2.5rem)" }}>
      <div className="container dash-layout">
        <nav className="dash-nav" aria-label={t("nav")}>
          {ITEMS.map((i) => (
            <Link key={i.href} href={i.href} aria-current={current === i.href ? "page" : undefined}>
              <Icon name={i.icon} />
              {t(`sections.${i.key}`)}
            </Link>
          ))}
        </nav>
        <div className="stack" style={{ gap: 24, minInlineSize: 0 }}>
          <h1 style={{ fontSize: "var(--fs-2xl)" }}>{title}</h1>
          {children}
        </div>
      </div>
    </section>
  );
}
