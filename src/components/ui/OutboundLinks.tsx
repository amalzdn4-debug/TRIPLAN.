"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import type { OutboundLink } from "@/lib/links";

/**
 * External links. Approved affiliate partners carry a visible "Partner" label and
 * rel="sponsored"; plain search links don't. Never invents availability or prices.
 */
export function OutboundLinks({ links }: { links: OutboundLink[] }) {
  const t = useTranslations("common");
  return (
    <div className="link-list">
      {links.map((l) => (
        <a key={`${l.provider}-${l.url}`} className={`ext-link ${l.partner ? "ext-link--partner" : ""}`} href={l.url} target="_blank" rel={l.partner ? "sponsored noopener noreferrer" : "noopener noreferrer nofollow"}>
          {l.provider}
          {l.partner ? <span className="badge badge--gold partner-badge">{t("partner")}</span> : null}
          <Icon name="external" className="flip-rtl" />
        </a>
      ))}
    </div>
  );
}

/** The affiliate disclosure, shown only next to links that really include a partner. */
export function PartnerDisclosure({ links }: { links: OutboundLink[] }) {
  const t = useTranslations("common");
  return links.some((l) => l.partner) ? <>{t("partnerDisclosure")}</> : null;
}
