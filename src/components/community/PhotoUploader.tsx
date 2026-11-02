"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";

export interface UploadedPhoto {
  id: string;
  url: string;
  alt: string;
  /** Uploaded in this session (not yet saved with the post): removing it deletes the file right away. */
  fresh?: boolean;
}

const MAX_PHOTOS = 6;
const MAX_SIDE = 2048;
const MIN_SIDE = 200;

type Problem = "unsupported" | "tooSmall" | "tooLarge" | "uploadFailed" | "uploadsDisabled" | "rateLimited" | "tooManyPending" | "signInRequired" | "verifyEmailFirst";

/**
 * Resizes and re-encodes in the browser before upload. Re-encoding through a canvas keeps only
 * the pixels, so location (GPS) and camera metadata never leave the device. The server checks
 * the file again regardless.
 */
async function prepare(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw "unsupported" as Problem;
  }
  const { width, height } = bitmap;
  if (Math.min(width, height) < MIN_SIDE) throw "tooSmall" as Problem;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw "unsupported" as Problem;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw "unsupported" as Problem;
  if (blob.size > 4 * 1024 * 1024) throw "tooLarge" as Problem;
  return blob;
}

export function PhotoUploader({ enabled, initial = [], name = "photos" }: { enabled: boolean; initial?: UploadedPhoto[]; name?: string }) {
  const t = useTranslations("upload");
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initial);
  const [busy, setBusy] = useState(0);
  const [problems, setProblems] = useState<{ file: string; problem: Problem }[]>([]);
  const input = useRef<HTMLInputElement>(null);
  // Photos uploaded but never published are removed by the daily cleanup job.

  const room = MAX_PHOTOS - photos.length - busy;

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, Math.max(0, room));
    setProblems(Array.from(files).length > list.length ? [{ file: "", problem: "tooManyPending" }] : []);
    setBusy((b) => b + list.length);
    for (const file of list) {
      try {
        const blob = await prepare(file);
        const body = new FormData();
        body.append("file", blob, "photo.jpg");
        const res = await fetch("/api/uploads", { method: "POST", body, credentials: "same-origin" });
        const data = (await res.json().catch(() => ({}))) as { id?: string; url?: string; error?: Problem };
        if (!res.ok || !data.id || !data.url) throw (data.error ?? "uploadFailed") as Problem;
        setPhotos((p) => [...p, { id: data.id!, url: data.url!, alt: "", fresh: true }]);
      } catch (e) {
        setProblems((p) => [...p, { file: file.name, problem: (typeof e === "string" ? e : "uploadFailed") as Problem }]);
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (input.current) input.current.value = "";
  }

  function remove(photo: UploadedPhoto) {
    setPhotos((p) => p.filter((x) => x.id !== photo.id));
    if (photo.fresh) void fetch(`/api/uploads/${photo.id}`, { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
  }

  function move(i: number, d: number) {
    setPhotos((p) => {
      const next = [...p];
      const j = i + d;
      if (j < 0 || j >= next.length) return p;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  if (!enabled) {
    return (
      <div className="field">
        <span className="field-label">{t("label")}</span>
        <p className="small muted" style={{ margin: 0 }}>{t("disabled")}</p>
        <input type="hidden" name={name} value={JSON.stringify(photos.map((p) => ({ id: p.id, alt: p.alt })))} />
      </div>
    );
  }

  return (
    <div className="field photo-uploader">
      <span className="field-label" id="photos-label">{t("label")}</span>
      <p className="small muted" style={{ margin: 0 }}>{t("hint", { max: MAX_PHOTOS })}</p>
      {photos.length ? (
        <ul className="photo-grid" aria-labelledby="photos-label">
          {photos.map((p, i) => (
            <li key={p.id} className="photo-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.alt || t("photoN", { n: i + 1 })} />
              <div className="photo-tile__bar">
                <button type="button" className="btn btn--icon btn--sm" aria-label={t("moveEarlier")} disabled={i === 0} onClick={() => move(i, -1)}>
                  <Icon name="chevronLeft" className="flip-rtl" />
                </button>
                <button type="button" className="btn btn--icon btn--sm" aria-label={t("moveLater")} disabled={i === photos.length - 1} onClick={() => move(i, 1)}>
                  <Icon name="chevronRight" className="flip-rtl" />
                </button>
                <button type="button" className="btn btn--icon btn--sm btn--danger" aria-label={t("remove", { n: i + 1 })} onClick={() => remove(p)}>
                  <Icon name="trash" />
                </button>
              </div>
              <label className="visually-hidden" htmlFor={`alt-${p.id}`}>{t("altLabel", { n: i + 1 })}</label>
              <input
                id={`alt-${p.id}`}
                className="input input--sm"
                placeholder={t("altPlaceholder")}
                maxLength={200}
                value={p.alt}
                onChange={(e) => setPhotos((all) => all.map((x) => (x.id === p.id ? { ...x, alt: e.target.value } : x)))}
              />
            </li>
          ))}
          {Array.from({ length: busy }, (_, i) => (
            <li key={`busy-${i}`} className="photo-tile photo-tile--busy" aria-live="polite">
              <span className="spinner" />
              <span className="small">{t("uploading")}</span>
            </li>
          ))}
        </ul>
      ) : busy ? (
        <p className="small" aria-live="polite"><span className="spinner" /> {t("uploading")}</p>
      ) : null}
      {room > 0 ? (
        <label className="btn btn--sm photo-uploader__pick">
          <Icon name="plus" />
          {photos.length ? t("addMore") : t("add")}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="visually-hidden" onChange={(e) => void add(e.target.files)} />
        </label>
      ) : (
        <p className="small muted">{t("max", { max: MAX_PHOTOS })}</p>
      )}
      {problems.length ? (
        <ul className="small" role="alert" style={{ color: "var(--color-danger)", margin: 0 }}>
          {problems.map((p, i) => (
            <li key={i}>{p.file ? `${p.file}: ` : ""}{t(`problems.${p.problem}`)}</li>
          ))}
        </ul>
      ) : null}
      <p className="small muted" style={{ margin: 0 }}>{t("rights")}</p>
      <input type="hidden" name={name} value={JSON.stringify(photos.map((p) => ({ id: p.id, alt: p.alt.trim() })))} />
    </div>
  );
}
