"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createPostAction, updatePostAction } from "@/actions/community";
import { Field, FormMessage, SubmitButton, useFieldError } from "@/components/ui/Form";
import { PhotoUploader, type UploadedPhoto } from "./PhotoUploader";
import type { ActionState } from "@/lib/validation";

const LocationPicker = dynamic(() => import("@/components/map/LocationPicker").then((m) => m.LocationPicker), { ssr: false });

const TYPES = ["recommendation", "hidden_gem", "review", "restaurant", "tip"] as const;

export interface PostFormInitial {
  postId: string;
  destinationSlug: string;
  type: (typeof TYPES)[number];
  title: string;
  body: string;
  rating: number | null;
  placeName: string | null;
  lat: number | null;
  lng: number | null;
  photos: UploadedPhoto[];
}

export function PostForm({
  destinations,
  defaultDestination,
  uploadsEnabled,
  initial,
}: {
  destinations: { slug: string; label: string; lat: number; lng: number }[];
  defaultDestination?: string;
  uploadsEnabled: boolean;
  /** Present when editing an existing post. */
  initial?: PostFormInitial;
}) {
  const t = useTranslations("community");
  const [state, action] = useActionState(initial ? updatePostAction.bind(null, initial.postId) : createPostAction, { ok: false } as ActionState);
  const err = useFieldError(state);
  const v = (k: string, fallback: string) => (state.values?.[k] as string | undefined) ?? fallback;
  const [type, setType] = useState<string>(v("type", initial?.type ?? "recommendation"));
  const [dest, setDest] = useState<string>(v("destinationSlug", initial?.destinationSlug ?? defaultDestination ?? ""));
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null);
  const [showPin, setShowPin] = useState(Boolean(pin));
  const center = destinations.find((d) => d.slug === dest);
  const postId = (state.values?.postId as string | undefined) ?? initial?.postId;

  return (
    <form action={action} className="form card" id="share" key={state.ok && !initial ? "done" : "form"}>
      <h2 style={{ fontSize: "var(--fs-lg)" }}>{initial ? t("editTitle") : t("shareTitle")}</h2>
      <p className="small muted">{t("shareRules")}</p>
      <FormMessage state={state} />
      {state.ok && postId ? (
        <p className="small" style={{ margin: 0 }}>
          <Link href={`/community/posts/${postId}`}>{t("viewPost")}</Link>
        </p>
      ) : null}
      <div className="form-row">
        <Field label={t("destination")} name="destinationSlug" error={err("destinationSlug")}>
          {(p) => (
            <select {...p} className="select" value={dest} onChange={(e) => { setDest(e.target.value); setPin(null); }}>
              <option value="">{t("chooseDestination")}</option>
              {destinations.map((d) => <option key={d.slug} value={d.slug}>{d.label}</option>)}
            </select>
          )}
        </Field>
        <Field label={t("type")} name="type" error={err("type")}>
          {(p) => (
            <select {...p} className="select" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((x) => <option key={x} value={x}>{t(`types.${x}`)}</option>)}
            </select>
          )}
        </Field>
        {type === "review" ? (
          <Field label={t("rating")} name="rating" error={err("rating")}>
            {(p) => (
              <select {...p} className="select" defaultValue={v("rating", String(initial?.rating ?? 5))}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{t("stars", { n })}</option>)}
              </select>
            )}
          </Field>
        ) : null}
      </div>
      <Field label={t("postTitle")} name="title" error={err("title")}>
        {(p) => <input {...p} className="input" maxLength={140} defaultValue={v("title", initial?.title ?? "")} />}
      </Field>
      <Field label={t("body")} name="body" error={err("body")} hint={t("bodyHint")}>
        {(p) => <textarea {...p} className="textarea" maxLength={4000} defaultValue={v("body", initial?.body ?? "")} />}
      </Field>
      <PhotoUploader enabled={uploadsEnabled} initial={initial?.photos} />
      {err("photos") ? <p className="field-error" role="alert">{t("photosInvalid")}</p> : null}
      <Field label={t("placeName")} name="placeName" error={err("placeName")} hint={t("placeHint")}>
        {(p) => <input {...p} className="input" maxLength={140} defaultValue={v("placeName", initial?.placeName ?? "")} />}
      </Field>
      {center ? (
        <div className="stack" style={{ gap: 8 }}>
          {showPin ? (
            <>
              <LocationPicker center={pin ?? { lat: center.lat, lng: center.lng }} value={pin} onChange={setPin} />
              <div className="cluster" style={{ gap: 8 }}>
                <span className="small muted">{pin ? t("pinSet") : t("pinHint")}</span>
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => { setPin(null); setShowPin(false); }}>{t("removePin")}</button>
              </div>
            </>
          ) : (
            <button type="button" className="btn btn--sm" style={{ justifySelf: "start" }} onClick={() => setShowPin(true)}>{t("addPin")}</button>
          )}
        </div>
      ) : null}
      <input type="hidden" name="lat" value={pin?.lat ?? ""} />
      <input type="hidden" name="lng" value={pin?.lng ?? ""} />
      <div className="cluster">
        <SubmitButton>{initial ? t("saveChanges") : t("publish")}</SubmitButton>
        {initial ? <Link href={`/community/posts/${initial.postId}`} className="btn btn--ghost">{t("cancel")}</Link> : null}
      </div>
    </form>
  );
}
