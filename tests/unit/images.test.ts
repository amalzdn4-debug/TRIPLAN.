import { describe, it, expect } from "vitest";
import { sizedUrl, WIKIMEDIA_STEPS } from "@/lib/images";

const W = (w: number) => `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Rome.jpg/${w}px-Rome.jpg`;
const widthOf = (u: string) => Number(u.match(/\/(\d+)px-/)?.[1]);

describe("Wikimedia photos use standard thumbnail widths only", () => {
  it("card, thumb and hero sizes are standard steps", () => {
    expect(sizedUrl(W(1920), "card")).toBe(W(960));
    expect(sizedUrl(W(1920), "thumb")).toBe(W(500));
    expect(sizedUrl(W(1920), "hero")).toBe(W(1280));
  });
  it("a stored non-standard width is snapped down to a standard one (never upscaled)", () => {
    expect(sizedUrl(W(1600), "hero")).toBe(W(1280));
    expect(sizedUrl(W(1024), "card")).toBe(W(960));
    expect(sizedUrl(W(800), "card")).toBe(W(500));
    expect(sizedUrl(W(400), "thumb")).toBe(W(330));
  });
  it("every result is in Wikimedia's list", () => {
    for (const w of [300, 640, 1000, 1500, 1920, 3000]) for (const slot of ["thumb", "card", "hero"] as const) {
      expect((WIKIMEDIA_STEPS as readonly number[]).includes(widthOf(sizedUrl(W(w), slot)))).toBe(true);
    }
  });
  it("original files and other hosts are left alone", () => {
    const orig = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Rome.jpg";
    expect(sizedUrl(orig, "card")).toBe(orig);
    const un = "https://images.unsplash.com/photo-1?w=1600";
    expect(sizedUrl(un, "hero")).toBe(un);
  });
});
