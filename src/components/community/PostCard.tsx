"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { deletePostAction, reportPostAction, toggleLikeAction, toggleSavePostAction } from "@/actions/community";
import type { PostView } from "@/lib/community";
import { ReportForm } from "./ReportForm";

export function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={url} alt="" />;
  }
  return (
    <span className="avatar" aria-hidden>
      {name ? name.slice(0, 1).toUpperCase() : <Icon name="user" />}
    </span>
  );
}

export function PostCard({ post, signedIn, compact = false, full = false }: { post: PostView; signedIn: boolean; compact?: boolean; full?: boolean }) {
  const t = useTranslations("community");
  const format = useFormatter();
  const router = useRouter();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likeCount);
  const [saved, setSaved] = useState(post.savedByMe);
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  const author = post.author || t("member");
  const href = `/community/posts/${post.id}`;
  const photos = full ? post.photos : post.photos.slice(0, compact ? 1 : 3);

  const requireAuth = () => {
    if (!signedIn) {
      setNotice(t("signInToInteract"));
      return false;
    }
    return true;
  };

  if (gone) return <p className="small muted" role="status">{t("deleted")}</p>;

  return (
    <article className={`post ${full ? "post--full" : ""}`} lang={post.locale}>
      {post.status !== "published" ? <p className="alert alert--warning small" style={{ margin: 0 }}>{t(`statusBanner.${post.status}`)}</p> : null}
      <div className="post__head">
        <Avatar name={post.author} url={post.authorAvatar} />
        <span>
          <bdi><Link href={`/community/members/${post.authorId}`} className="post__author">{author}</Link></bdi>
          <br />
          <span className="small">
            <bdi><Link href={`/destinations/${post.destinationSlug}`}>{post.destinationCity}</Link></bdi>
            {" · "}
            <bdi><time dateTime={post.createdAt}>{format.dateTime(new Date(post.createdAt), { dateStyle: "medium" })}</time></bdi>
            {post.editedAt ? <span className="muted"> · {t("edited")}</span> : null}
          </span>
        </span>
        <span style={{ marginInlineStart: "auto" }} className="cluster">
          <span className="badge badge--gold">{t(`types.${post.type}`)}</span>
          <span className="badge badge--outline" title={t("opinionHint")}>{t("opinion")}</span>
        </span>
      </div>
      <h3 dir="auto">{full ? post.title : <Link href={href} className="post__title-link">{post.title}</Link>}</h3>
      {post.placeName || (post.lat != null && post.lng != null) ? (
        <p className="post__place small">
          <Icon name="pin" />
          <bdi>{post.placeName ?? t("pinnedLocation")}</bdi>
          {post.lat != null && post.lng != null ? (
            <>
              {" · "}
              <a href={`https://www.openstreetmap.org/?mlat=${post.lat}&mlon=${post.lng}#map=17/${post.lat}/${post.lng}`} target="_blank" rel="noopener noreferrer">{t("openMap")}</a>
            </>
          ) : null}
        </p>
      ) : null}
      {post.rating ? (
        <span className="stars" aria-label={t("ratingLabel", { n: post.rating })}>
          {Array.from({ length: 5 }, (_, i) => <Icon key={i} name="star" fill={i < post.rating! ? "currentColor" : "none"} />)}
        </span>
      ) : null}
      {photos.length ? (
        <div className={`post-photos post-photos--${Math.min(photos.length, 3)} ${full ? "post-photos--full" : ""}`}>
          {photos.map((ph, i) => (
            <a key={ph.id} href={full ? ph.url : undefined} onClick={full ? undefined : (e) => { e.preventDefault(); router.push(href); }} target={full ? "_blank" : undefined} rel="noopener noreferrer" className="post-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.url} alt={ph.alt || t("photoAlt", { n: i + 1, title: post.title })} loading="lazy" width={ph.width ?? undefined} height={ph.height ?? undefined} />
              {!full && i === photos.length - 1 && post.photos.length > photos.length ? <span className="post-photo__more">+{post.photos.length - photos.length}</span> : null}
            </a>
          ))}
        </div>
      ) : null}
      <p className="post__body" dir="auto" style={compact ? { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}>{post.body}</p>
      <div className="post__actions">
        <button
          type="button"
          className="btn btn--sm toggle-btn"
          aria-pressed={liked}
          disabled={pending || post.status !== "published"}
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
        {!full ? (
          <Link href={`${href}#comments`} className="btn btn--sm">
            <Icon name="mail" />
            {t("commentsN", { n: post.commentCount })}
          </Link>
        ) : null}
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
        {post.mine ? (
          <>
            {post.status === "published" || post.status === "pending" ? (
              <Link href={`${href}/edit`} className="btn btn--sm btn--ghost"><Icon name="edit" />{t("edit")}</Link>
            ) : null}
            <button
              type="button"
              className="btn btn--sm btn--ghost btn--danger"
              disabled={pending}
              onClick={() =>
                confirm(t("confirmDelete")) &&
                start(async () => {
                  const r = await deletePostAction(post.id);
                  if (r.ok) {
                    if (full) router.push("/community");
                    else setGone(true);
                  } else setNotice(t("status.notAllowed"));
                })
              }
            >
              <Icon name="trash" />
              {t("delete")}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => requireAuth() && setReporting((r) => !r)} aria-expanded={reporting}>
            <Icon name="flag" />
            {t("report")}
          </button>
        )}
      </div>
      {reporting ? (
        <ReportForm
          id={post.id}
          onCancel={() => setReporting(false)}
          onSend={(reason, details) =>
            start(async () => {
              const r = await reportPostAction(post.id, reason, details);
              setNotice(t(`status.${r.message}`));
              setReporting(false);
            })
          }
          pending={pending}
        />
      ) : null}
      {notice ? (
        <p className="small muted" role="status">
          {notice} {!signedIn ? <Link href="/login">{t("signIn")}</Link> : null}
        </p>
      ) : null}
    </article>
  );
}
