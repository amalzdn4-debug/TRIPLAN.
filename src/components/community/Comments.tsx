"use client";

import { useActionState, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDateTime } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/Icon";
import { Field, FormMessage, SubmitButton, useFieldError } from "@/components/ui/Form";
import { addCommentAction, deleteCommentAction, reportCommentAction } from "@/actions/community";
import type { CommentView } from "@/lib/community";
import type { ActionState } from "@/lib/validation";
import { Avatar } from "./PostCard";
import { ReportForm } from "./ReportForm";
import { ResendVerification } from "@/components/account/ResendVerification";

export function Comments({ postId, comments, signedIn, canComment, verified, emailAvailable = true }: { postId: string; comments: CommentView[]; signedIn: boolean; canComment: boolean; verified: boolean; emailAvailable?: boolean }) {
  const t = useTranslations("community");
  const [state, action] = useActionState(addCommentAction.bind(null, postId), { ok: false } as ActionState);
  const err = useFieldError(state);
  return (
    <section id="comments" className="stack" style={{ gap: 16 }} aria-labelledby="comments-title">
      <h2 id="comments-title" style={{ fontSize: "var(--fs-lg)" }}>{t("commentsN", { n: comments.length })}</h2>
      {comments.length ? (
        <ol className="comment-list">
          {comments.map((c) => <CommentItem key={c.id} comment={c} signedIn={signedIn} />)}
        </ol>
      ) : (
        <p className="muted small">{t("noComments")}</p>
      )}
      {!signedIn ? (
        <p className="small">
          <Link href={{ pathname: "/login", query: { next: `/community/posts/${postId}` } }}>{t("signInToComment")}</Link>
        </p>
      ) : !verified ? (
        <p className="small muted">{t("verifyToComment")} <ResendVerification available={emailAvailable} /></p>
      ) : canComment ? (
        <form action={action} className="form" key={state.ok ? `ok-${comments.length}` : "form"}>
          <FormMessage state={state} />
          <Field label={t("addComment")} name="body" error={err("body")}>
            {(p) => <textarea {...p} className="textarea" maxLength={2000} required style={{ minBlockSize: 90 }} defaultValue={state.ok ? "" : ((state.values?.body as string) ?? "")} />}
          </Field>
          <div><SubmitButton>{t("postComment")}</SubmitButton></div>
        </form>
      ) : null}
    </section>
  );
}

function CommentItem({ comment, signedIn }: { comment: CommentView; signedIn: boolean }) {
  const t = useTranslations("community");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <li className="comment">
      <Avatar name={comment.author} url={comment.authorAvatar} />
      <div className="stack" style={{ gap: 4 }}>
        <p className="small" style={{ margin: 0 }}>
          <bdi><Link href={`/community/members/${comment.authorId}`} className="post__author">{comment.author || t("member")}</Link></bdi>
          {" · "}
          <bdi><time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</time></bdi>
        </p>
        <p dir="auto" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{comment.body}</p>
        <div className="cluster" style={{ gap: 6 }}>
          {comment.mine ? (
            <button
              type="button"
              className="btn btn--sm btn--ghost btn--danger"
              disabled={pending}
              onClick={() => confirm(t("confirmDeleteComment")) && start(async () => { if ((await deleteCommentAction(comment.id)).ok) setGone(true); })}
            >
              <Icon name="trash" />{t("delete")}
            </button>
          ) : signedIn ? (
            <button type="button" className="btn btn--sm btn--ghost" aria-expanded={reporting} onClick={() => setReporting((r) => !r)}>
              <Icon name="flag" />{t("report")}
            </button>
          ) : null}
        </div>
        {reporting ? (
          <ReportForm
            id={comment.id}
            pending={pending}
            onCancel={() => setReporting(false)}
            onSend={(reason, details) =>
              start(async () => {
                const r = await reportCommentAction(comment.id, reason, details);
                setNotice(t(`status.${r.message}`));
                setReporting(false);
              })
            }
          />
        ) : null}
        {notice ? <p className="small muted" role="status">{notice}</p> : null}
      </div>
    </li>
  );
}
