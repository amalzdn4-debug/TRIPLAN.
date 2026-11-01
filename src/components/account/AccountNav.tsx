import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";

export async function AccountNav({ current, isAdmin }: { current: string; isAdmin: boolean }) {
  const t = await getTranslations("nav");
  const items = [
    { href: "/trips", label: t("myTrips"), icon: "map" },
    { href: "/account/saved", label: t("saved"), icon: "bookmark" },
    { href: "/account", label: t("account"), icon: "user" },
    { href: "/account/billing", label: t("billing"), icon: "wallet" },
    ...(isAdmin ? [{ href: "/admin", label: t("admin"), icon: "shield" }] : []),
  ];
  return (
    <nav className="dash-nav" aria-label={t("accountMenu")}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={current === i.href ? "page" : undefined}>
          <Icon name={i.icon} />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
