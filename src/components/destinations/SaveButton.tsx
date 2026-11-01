"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { toggleSaveDestinationAction, toggleSavePlaceAction } from "@/actions/community";

export function SaveButton({ id, kind, initial, signedIn, onDark = false }: { id: string; kind: "destination" | "place"; initial: boolean; signedIn: boolean; onDark?: boolean }) {
  const t = useTranslations("common");
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={`btn btn--sm toggle-btn ${onDark ? "btn--on-dark" : ""}`}
      aria-pressed={saved}
      disabled={pending}
      onClick={() => {
        if (!signedIn) {
          router.push(`/login?next=${encodeURIComponent(window.location.pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/")}`);
          return;
        }
        start(async () => {
          const r = kind === "destination" ? await toggleSaveDestinationAction(id) : await toggleSavePlaceAction(id);
          if (r) setSaved(r.saved);
        });
      }}
    >
      <Icon name="bookmark" fill={saved ? "currentColor" : "none"} />
      {saved ? t("saved") : t("save")}
    </button>
  );
}
