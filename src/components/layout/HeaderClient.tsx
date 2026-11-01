"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { Logo } from "./Logo";
import { LanguageSelector } from "./LanguageSelector";
import { Dropdown } from "@/components/ui/Dropdown";
import { Icon } from "@/components/ui/Icon";
import { logoutAction } from "@/actions/auth";

type Labels = Record<
  "home" | "plan" | "explore" | "destinations" | "community" | "about" | "login" | "signup" | "myTrips" | "account" | "billing" | "saved" | "admin" | "logout" | "menu" | "close" | "accountMenu" | "mainNav" | "skip",
  string
>;

const NAV = [
  { href: "/", key: "home", icon: "home" },
  { href: "/plan", key: "plan", icon: "sparkles" },
  { href: "/explore", key: "explore", icon: "compass" },
  { href: "/destinations", key: "destinations", icon: "pin" },
  { href: "/community", key: "community", icon: "users" },
  { href: "/about", key: "about", icon: "info" },
] as const;

/** Pages whose first screen is a full-bleed photo get a transparent header until scrolled. */
function isOverlayPage(path: string) {
  return path === "/" || /^\/destinations\/[^/]+$/.test(path);
}

export function HeaderClient({ labels, user }: { labels: Labels; user: { name: string; role: string } | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const overlay = isOverlayPage(pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawer]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  return (
    <>
      <a className="skip-link" href="#main">
        {labels.skip}
      </a>
      <header className={`site-header ${overlay ? "site-header--overlay" : ""} ${scrolled ? "is-scrolled" : ""}`}>
        <div className="container site-header__inner">
          <Link href="/" className="site-header__brand" aria-label="TRIPLAN — Home">
            <Logo variant="white" className="logo-light" alt="" />
            <Logo variant="teal" className="logo-dark" alt="" />
          </Link>
          <nav className="main-nav" aria-label={labels.mainNav}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
                {labels[n.key]}
              </Link>
            ))}
          </nav>
          <div className="site-header__actions">
            <div className="hide-mobile">
              <LanguageSelector signedIn={!!user} />
            </div>
            {user ? (
              <>
                <Link href="/trips" className="btn btn--sm hide-mobile">
                  <Icon name="map" />
                  {labels.myTrips}
                </Link>
                <div className="hide-mobile">
                  <Dropdown
                    label={labels.accountMenu}
                    trigger={
                      <>
                        <span className="avatar" style={{ inlineSize: 30, blockSize: 30, fontSize: 13 }} aria-hidden>
                          {user.name.slice(0, 1).toUpperCase()}
                        </span>
                        <Icon name="chevronDown" />
                      </>
                    }
                  >
                    {(close) => (
                      <>
                        <Link href="/trips" onClick={close}>
                          <Icon name="map" />
                          {labels.myTrips}
                        </Link>
                        <Link href="/account/saved" onClick={close}>
                          <Icon name="bookmark" />
                          {labels.saved}
                        </Link>
                        <Link href="/account" onClick={close}>
                          <Icon name="user" />
                          {labels.account}
                        </Link>
                        <Link href="/account/billing" onClick={close}>
                          <Icon name="wallet" />
                          {labels.billing}
                        </Link>
                        {user.role === "admin" ? (
                          <Link href="/admin" onClick={close}>
                            <Icon name="shield" />
                            {labels.admin}
                          </Link>
                        ) : null}
                        <div className="menu-sep" role="separator" />
                        <form action={logoutAction}>
                          <button type="submit">
                            <Icon name="logout" />
                            {labels.logout}
                          </button>
                        </form>
                      </>
                    )}
                  </Dropdown>
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn--sm hide-mobile">
                  {labels.login}
                </Link>
                <Link href="/signup" className="btn btn--sm btn--gold">
                  {labels.signup}
                </Link>
              </>
            )}
            <button type="button" className="btn btn--icon btn--ghost menu-toggle" aria-label={labels.menu} aria-expanded={drawer} onClick={() => setDrawer(true)} style={{ color: "inherit" }}>
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      {drawer ? (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} aria-hidden />
          <div className="drawer" role="dialog" aria-modal="true" aria-label={labels.menu}>
            <div className="cluster" style={{ justifyContent: "space-between" }}>
              <Logo variant="teal" height={26} />
              <button type="button" className="btn btn--icon btn--ghost" aria-label={labels.close} onClick={() => setDrawer(false)} autoFocus>
                <Icon name="close" />
              </button>
            </div>
            <nav aria-label={labels.mainNav}>
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
                  <Icon name={n.icon} />
                  {labels[n.key]}
                </Link>
              ))}
              {user ? (
                <>
                  <Link href="/trips" aria-current={isActive("/trips") ? "page" : undefined}>
                    <Icon name="map" />
                    {labels.myTrips}
                  </Link>
                  <Link href="/account" aria-current={pathname === "/account" ? "page" : undefined}>
                    <Icon name="user" />
                    {labels.account}
                  </Link>
                  {user.role === "admin" ? (
                    <Link href="/admin">
                      <Icon name="shield" />
                      {labels.admin}
                    </Link>
                  ) : null}
                </>
              ) : null}
            </nav>
            <LanguageSelector signedIn={!!user} />
            <div style={{ marginBlockStart: "auto", display: "grid", gap: 8 }}>
              {user ? (
                <form action={logoutAction}>
                  <button type="submit" className="btn btn--block">
                    <Icon name="logout" />
                    {labels.logout}
                  </button>
                </form>
              ) : (
                <>
                  <Link href="/login" className="btn btn--block">
                    {labels.login}
                  </Link>
                  <Link href="/signup" className="btn btn--block btn--primary">
                    {labels.signup}
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
