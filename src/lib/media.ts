/**
 * Image checks for user uploads. Pure functions (unit-tested).
 *
 * The browser already resizes and re-encodes photos before upload (which drops metadata), but the
 * server never trusts that: it checks the real file type from the bytes (not the file name or the
 * declared type), reads the dimensions, and removes metadata blocks such as EXIF (which can contain
 * the GPS position where a photo was taken) before anything is stored.
 */

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel functions accept request bodies up to 4.5 MB
export const MIN_SIDE = 200;
export const MAX_SIDE = 6000;
export const MAX_PHOTOS_PER_POST = 6;

export type ImageType = "image/jpeg" | "image/webp";

export interface ImageInfo {
  type: ImageType;
  width: number;
  height: number;
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32le = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

/** Start-of-frame markers carry the image size. */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegInfo(b: Uint8Array): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // reached end/scan without a frame header
    const len = u16be(b, i + 2);
    if (len < 2 || i + 2 + len > b.length) return null;
    if (SOF.has(marker)) {
      const height = u16be(b, i + 5);
      const width = u16be(b, i + 7);
      return width && height ? { type: "image/jpeg", width, height } : null;
    }
    i += 2 + len;
  }
  return null;
}

function webpInfo(b: Uint8Array): ImageInfo | null {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const chunk = ascii(b, 12, 4);
  const d = 20; // chunk data start
  if (chunk === "VP8X") return { type: "image/webp", width: u24le(b, d + 4) + 1, height: u24le(b, d + 7) + 1 };
  if (chunk === "VP8 ") {
    if (b[d + 3] !== 0x9d || b[d + 4] !== 0x01 || b[d + 5] !== 0x2a) return null;
    return { type: "image/webp", width: (b[d + 6] | (b[d + 7] << 8)) & 0x3fff, height: (b[d + 8] | (b[d + 9] << 8)) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (b[d] !== 0x2f) return null;
    const bits = u32le(b, d + 1);
    return { type: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

/** Identifies a JPEG or WebP image from its bytes. Anything else returns null. */
export function sniffImage(bytes: Uint8Array): ImageInfo | null {
  return jpegInfo(bytes) ?? webpInfo(bytes);
}

/**
 * Removes metadata: in JPEG every APPn segment except JFIF (APP0) and the colour profile (APP2),
 * plus comments; in WebP the EXIF and XMP chunks. Image data is copied unchanged.
 */
export function stripMetadata(bytes: Uint8Array, type: ImageType): Uint8Array {
  if (type === "image/jpeg") {
    const out: Uint8Array[] = [bytes.subarray(0, 2)];
    let i = 2;
    while (i + 4 <= bytes.length) {
      const marker = bytes[i + 1];
      if (marker === 0xda) {
        out.push(bytes.subarray(i)); // start of scan: the rest is image data
        break;
      }
      const len = u16be(bytes, i + 2);
      const end = i + 2 + len;
      const isApp = marker >= 0xe0 && marker <= 0xef;
      const keep = !(isApp && marker !== 0xe0 && marker !== 0xe2) && marker !== 0xfe;
      if (keep) out.push(bytes.subarray(i, end));
      i = end;
    }
    return concat(out);
  }
  // WebP (RIFF container)
  const parts: Uint8Array[] = [];
  let i = 12;
  let vp8x: Uint8Array | null = null;
  while (i + 8 <= bytes.length) {
    const id = ascii(bytes, i, 4);
    const size = u32le(bytes, i + 4);
    const end = Math.min(bytes.length, i + 8 + size + (size & 1));
    const chunk = bytes.slice(i, end);
    if (id === "VP8X") vp8x = chunk;
    if (id !== "EXIF" && id !== "XMP ") parts.push(chunk);
    i = end;
  }
  if (vp8x) vp8x[8] &= ~(0x08 | 0x04); // clear the "has EXIF" and "has XMP" flags
  const body = concat(parts);
  const head = new Uint8Array(12);
  head.set(bytes.subarray(0, 12));
  const riffSize = body.length + 4;
  head[4] = riffSize & 0xff;
  head[5] = (riffSize >> 8) & 0xff;
  head[6] = (riffSize >> 16) & 0xff;
  head[7] = (riffSize >>> 24) & 0xff;
  return concat([head, body]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export type UploadProblem = "tooLarge" | "empty" | "unsupported" | "tooSmall" | "tooBig";

/** Full server-side validation. Returns the cleaned bytes and info, or the reason it was refused. */
export function checkUpload(bytes: Uint8Array): { ok: true; info: ImageInfo; bytes: Uint8Array } | { ok: false; problem: UploadProblem } {
  if (!bytes.length) return { ok: false, problem: "empty" };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, problem: "tooLarge" };
  const info = sniffImage(bytes);
  if (!info) return { ok: false, problem: "unsupported" };
  if (Math.min(info.width, info.height) < MIN_SIDE) return { ok: false, problem: "tooSmall" };
  if (Math.max(info.width, info.height) > MAX_SIDE) return { ok: false, problem: "tooBig" };
  return { ok: true, info, bytes: stripMetadata(bytes, info.type) };
}
