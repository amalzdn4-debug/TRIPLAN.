import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { LOCALES, LOCALE_META } from "@/config/locales";

const dir = path.join(process.cwd(), "messages");
const load = (l: string) => JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), "utf8"));
const flat = (o: Record<string, unknown>, p = ""): Record<string, string> =>
  Object.entries(o).reduce((acc, [k, v]) => (typeof v === "string" ? { ...acc, [p + k]: v } : { ...acc, ...flat(v as Record<string, unknown>, `${p + k}.`) }), {} as Record<string, string>);
const placeholders = (s: string) => Array.from(new Set((s.match(/\{(\w+)[,}]/g) ?? []).map((m) => m.slice(1, -1)))).sort();
const ENGLISH_ONLY = ["admin."];

describe("translations", () => {
  const en = flat(load("en"));

  it("supports the eight required languages, with Arabic right-to-left", () => {
    expect([...LOCALES].sort()).toEqual(["ar", "en", "es", "fr", "it", "pt", "ru", "zh"]);
    expect(LOCALE_META.ar.dir).toBe("rtl");
    for (const l of LOCALES) if (l !== "ar") expect(LOCALE_META[l].dir).toBe("ltr");
  });

  for (const locale of LOCALES.filter((l) => l !== "en")) {
    it(`${locale} has every key with matching placeholders`, () => {
      const m = flat(load(locale));
      for (const [k, v] of Object.entries(en)) {
        if (ENGLISH_ONLY.some((p) => k.startsWith(p))) continue;
        expect(m[k], `${locale}: ${k}`).toBeTypeOf("string");
        expect(placeholders(m[k]), `${locale}: ${k}`).toEqual(placeholders(v));
      }
    });

    it(`${locale} uses valid plural categories`, () => {
      const cats = new Set<string>(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
      for (const [k, v] of Object.entries(flat(load(locale)))) {
        const m = v.match(/plural,\s*(.*)$/s);
        if (!m) continue;
        const sels = Array.from(m[1].matchAll(/(?:^|\})\s*(=?\w+)\s*\{/g)).map((x) => x[1]);
        expect(sels, k).toContain("other");
        for (const s of sels) if (!s.startsWith("=")) expect(cats.has(s), `${locale}: ${k} uses '${s}'`).toBe(true);
      }
    });
  }
});
