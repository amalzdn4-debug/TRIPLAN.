"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { reportPostAction, toggleLikeAction, toggleSavePostAction } from "@/actions/community";
import type { PostView } from "@/lib/community";

export function PostCard({ post, signedIn, compact = false }: { post: PostView; signedIn: boolean; compact?: boolean }) {
  const t = useTranslations("community");
  const format = useFormatter();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likeCount);
  const [saved, setSaved] = useState(post.savedByMe);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const requireAuth = () => {
    if (!signedIn) {
      setNotice(t("signInToInteract"));
      return false;
    }
    return true;
  };

  return (
    <article className="post" lang={post.locale}>
      <div className="post__head">
        <span className="avatar" aria-hidden>
          {post.author.slice(0, 1).toUpperCase()}
        </span>
        <span>
          <strong style={{ color: "var(--color-heading)" }}>{post.author}</strong>
          <br />
          <span className="small">
            <Link href={`/destinations/${post.destinationSlug}`}>{post.destinationCity}</Link> · <time dateTime={post.createdAt}>{format.dateTime(new Date(post.createdAt), { dateStyle: "medium" })}</time>
          </span>
        </span>
        <span style={{ marginInlineStart: "auto" }} className="cluster">
          <span className="badge badge--gold">{t(`types.${post.type}`)}</span>
          <span className="badge badge--outline" title={t("opinionHint")}>
            {t("opinion")}
          </span>
        </span>
      </div>
      <h3>{post.title}</h3>
      {post.rating ? (
        <span className="stars" aria-label={t("ratingLabel", { n: post.rating })}>
          {Array.from({ length: 5 }, (_, i) => (
            <Icon key={i} name="star" fill={i < post.rating! ? "currentColor" : "none"} />
          ))}
        </span>
      ) : null}
      <p style={compact ? { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}>{post.body}</p>
      <div className="post__actions">
        <button
          type="button"
          className="btn btn--sm toggle-btn"
          aria-pressed={liked}
          disabled={pending}
          onClick={() =>
            requireAuth() &&
            start(async () => {
              const r = await toggleLikeAction(post.id);
              if (r) {
                setLiked(r.liked);
                setLikes(r.count);
              }
            })
          }
        >
          <Icon name="heart" fill={liked ? "currentColor" : "none"} />
          {t("helpful")} · {likes}
        </button>
        <button
          type="button"
          className="btn btn--sm toggle-btn"
          aria-pressed={saved}
          disabled={pending}
          onClick={() =>
            requireAuth() &&
            start(async () => {
              const r = await toggleSavePostAction(post.id);
              if (r) setSaved(r.saved);
            })
          }
        >
          <Icon name="bookmark" fill={saved ? "currentColor" : "none"} />
          {saved ? t("saved") : t("save")}
        </button>
        {!post.mine ? (
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => requireAuth() && setReporting((r) => !r)} aria-expanded={reporting}>
            <Icon name="flag" />
            {t("report")}
          </button>
        ) : null}
      </div>
      {reporting ? (
        <form
          className="form card card--muted card--flat"
          style={{ padding: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await reportPostAction(post.id, reason, details);
              setNotice(t(`status.${r.message}`));
              setReporting(false);
            });
          }}
        >
          <div className="field">
            <label htmlFor={`reason-${post.id}`}>{t("reportReason")}</label>
            <select id={`reason-${post.id}`} className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
              {["spam", "offensive", "misleading", "unsafe", "other"].map((r) => (
                <option key={r} value={r}>
                  {t(`reasons.${r}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`details-${post.id}`}>{t("reportDetails")}</label>
            <textarea id={`details-${post.id}`} className="textarea" maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} style={{ minBlockSize: 80 }} />
          </div>
          <div className="cluster">
            <button type="submit" className="btn btn--sm btn--primary" disabled={pending}>
              {t("sendReport")}
            </button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setReporting(false)}>
              {t("cancel")}
            </button>
          </div>
        </form>
      ) : null}
      {notice ? (
        <p className="small muted" role="status">
          {notice}{" "}
          {!signedIn ? <Link href="/login">{t("signIn")}</Link> : null}
        </p>
      ) : null}
    </article>
  );
}
