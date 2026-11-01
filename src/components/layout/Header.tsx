import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { HeaderClient } from "./HeaderClient";

export async function Header() {
  const user = await getCurrentUser();
  const t = await getTranslations("nav");
  const labels = {
    home: t("home"),
    plan: t("plan"),
    explore: t("explore"),
    destinations: t("destinations"),
    community: t("community"),
    about: t("about"),
    login: t("login"),
    signup: t("signup"),
    myTrips: t("myTrips"),
    account: t("account"),
    billing: t("billing"),
    saved: t("saved"),
    admin: t("admin"),
    logout: t("logout"),
    menu: t("menu"),
    close: t("close"),
    accountMenu: t("accountMenu"),
    mainNav: t("mainNav"),
    skip: t("skip"),
  };
  return <HeaderClient labels={labels} user={user ? { name: user.displayName, role: user.role } : null} />;
}
