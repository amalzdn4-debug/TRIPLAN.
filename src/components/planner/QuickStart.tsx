"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { todayPlus } from "./shared";

/** "Where to?" — preferences entered here survive the sign-in step via the URL. */
export function QuickStart({ destinations }: { destinations: { slug: string; city: string; country: string }[] }) {
  const t = useTranslations("planIntro");
  const router = useRouter();
  const [dest, setDest] = useState("");
  const [start, setStart] = useState(todayPlus(30));
  const [end, setEnd] = useState(todayPlus(33));
  return (
    <form
      className="card"
      style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBlockStart: 28, maxInlineSize: 880 }}
      onSubmit={(e) => {
        e.preventDefault();
        const q = new URLSearchParams({ ...(dest ? { destination: dest } : {}), start, end });
        router.push(`/plan/fast?${q}`);
      }}
    >
      <div className="field" style={{ flex: "2 1 220px" }}>
        <label htmlFor="qs-dest">{t("whereTo")}</label>
        <select id="qs-dest" className="select" value={dest} onChange={(e) => setDest(e.target.value)}>
          <option value="">{t("anyDestination")}</option>
          {destinations.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.city}, {d.country}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ flex: "1 1 150px" }}>
        <label htmlFor="qs-start">{t("from")}</label>
        <input id="qs-start" className="input" type="date" min={todayPlus(0)} value={start} onChange={(e) => setStart(e.target.value)} />
      </div>
      <div className="field" style={{ flex: "1 1 150px" }}>
        <label htmlFor="qs-end">{t("to")}</label>
        <input id="qs-end" className="input" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <button type="submit" className="btn btn--primary btn--lg" style={{ flex: "1 1 160px" }}>
        {t("start")}
        <Icon name="arrowRight" className="flip-rtl" />
      </button>
    </form>
  );
}
