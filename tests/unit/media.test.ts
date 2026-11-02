import { describe, it, expect } from "vitest";
import { checkUpload, sniffImage, stripMetadata, MAX_UPLOAD_BYTES } from "@/lib/media";

const bytes = (...parts: (number[] | string)[]) => new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const seg = (marker: number, payload: number[]) => [0xff, marker, ((payload.length + 2) >> 8) & 0xff, (payload.length + 2) & 0xff, ...payload];

/** Structurally valid JPEG header with a fake GPS EXIF block and a 1200×800 frame. */
function fakeJpeg(w = 1200, h = 800) {
  const exif = [..."Exif\0\0GPSLatitude=41.9".split("").map((c) => c.charCodeAt(0))];
  return bytes([0xff, 0xd8], seg(0xe0, [..."JFIF\0".split("").map((c) => c.charCodeAt(0)), 1, 1, 0, 0, 1, 0, 1, 0, 0]), seg(0xe1, exif), seg(0xfe, [..."comment".split("").map((c) => c.charCodeAt(0))]), seg(0xc0, [8, h >> 8, h & 0xff, w >> 8, w & 0xff, 1, 1, 0x11, 0]), seg(0xda, [1, 1, 0, 0, 63, 0]), [1, 2, 3, 4, 0xff, 0xd9]);
}

function fakeWebp(w = 1000, h = 700) {
  const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
  const vp8x = ["VP8X", le32(10), [0x08 | 0x04, 0, 0, 0], le24(w - 1), le24(h - 1)];
  const exif = ["EXIF", le32(6), "GPS=1\0"];
  const img = ["VP8L", le32(6), [0x2f, 0, 0, 0, 0, 0]];
  const body = bytes("WEBP", ...(vp8x as any), ...(exif as any), ...(img as any));
  return bytes("RIFF", le32(body.length), Array.from(body));
}

const text = (b: Uint8Array) => String.fromCharCode(...b);

describe("upload checks", () => {
  it("identifies JPEG and WebP from the bytes and reads the size", () => {
    expect(sniffImage(fakeJpeg())).toEqual({ type: "image/jpeg", width: 1200, height: 800 });
    expect(sniffImage(fakeWebp())).toEqual({ type: "image/webp", width: 1000, height: 700 });
  });

  it("rejects other formats regardless of the declared type or file name", () => {
    const png = bytes([0x89], "PNG\r\n\x1a\n", new Array(40).fill(0));
    const svg = bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const html = bytes("<html><body>hi</body></html>");
    for (const b of [png, svg, html]) expect(checkUpload(b)).toEqual({ ok: false, problem: "unsupported" });
  });

  it("removes EXIF/GPS and comments from JPEG but keeps the image", () => {
    const src = fakeJpeg();
    const out = stripMetadata(src, "image/jpeg");
    expect(text(src).includes("GPSLatitude")).toBe(true);
    expect(text(out).includes("GPSLatitude")).toBe(false);
    expect(text(out).includes("comment")).toBe(false);
    expect(text(out).includes("JFIF")).toBe(true);
    expect(sniffImage(out)).toEqual({ type: "image/jpeg", width: 1200, height: 800 });
    expect(Array.from(out.slice(-6))).toEqual([1, 2, 3, 4, 0xff, 0xd9]);
  });

  it("removes EXIF from WebP, clears the flag and fixes the container size", () => {
    const out = stripMetadata(fakeWebp(), "image/webp");
    expect(text(out).includes("GPS=1")).toBe(false);
    expect(out[20] & 0x08).toBe(0);
    const riff = out[4] | (out[5] << 8) | (out[6] << 16) | (out[7] << 24);
    expect(riff).toBe(out.length - 8);
    expect(sniffImage(out)).toEqual({ type: "image/webp", width: 1000, height: 700 });
  });

  it("enforces size and dimension limits", () => {
    expect(checkUpload(new Uint8Array(0))).toEqual({ ok: false, problem: "empty" });
    expect(checkUpload(new Uint8Array(MAX_UPLOAD_BYTES + 1))).toEqual({ ok: false, problem: "tooLarge" });
    expect(checkUpload(fakeJpeg(150, 100))).toEqual({ ok: false, problem: "tooSmall" });
    expect(checkUpload(fakeJpeg(9000, 5000))).toEqual({ ok: false, problem: "tooBig" });
    const ok = checkUpload(fakeJpeg());
    expect(ok.ok).toBe(true);
  });
});
