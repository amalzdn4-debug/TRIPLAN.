"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";

/** Mobile-only app-style navigation (hidden ≥ 761px via CSS). */
export function BottomNav({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = [
    { href: "/", label: t("home"), icon: "home" },
    { href: "/explore", label: t("explore"), icon: "compass" },
    { href: "/plan", label: t("planShort"), icon: "plus", primary: true },
    { href: "/trips", label: t("myTrips"), icon: "map" },
    { href: signedIn ? "/account" : "/login", label: signedIn ? t("account") : t("login"), icon: "user" },
  ];
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav className="bottom-nav" aria-label={t("mobileNav")}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined} className={i.primary ? "bottom-nav__primary" : undefined}>
          <Icon name={i.icon} />
          <span>{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}
