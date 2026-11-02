import "server-only";
import { features } from "@/lib/env";

/**
 * File storage for user photos (Vercel Blob). The token is read by the SDK from
 * BLOB_READ_WRITE_TOKEN on the server only — it is never sent to the browser.
 * When the token is missing, uploads are switched off (the UI says so) rather than faked.
 */
export async function storeImage(pathname: string, bytes: Uint8Array, contentType: string): Promise<{ url: string; pathname: string }> {
  if (!features.uploads()) throw new Error("uploads_disabled");
  const { put } = await import("@vercel/blob");
  const res = await put(pathname, Buffer.from(bytes), { access: "public", contentType, addRandomSuffix: true });
  return { url: res.url, pathname: res.pathname };
}

/** Deletes stored files. Failures are logged, never thrown, so a cleanup can't block deleting data. */
export async function deleteStored(urls: string[]): Promise<void> {
  const list = urls.filter(Boolean);
  if (!list.length || !features.uploads()) return;
  try {
    const { del } = await import("@vercel/blob");
    for (let i = 0; i < list.length; i += 100) await del(list.slice(i, i + 100));
  } catch (err) {
    console.error("[storage] delete failed", err);
  }
}
