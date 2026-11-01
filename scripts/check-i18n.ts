/**
 * Translation completeness check.
 *  1. Every key used statically in the code (t("a.b")) exists in messages/en.json.
 *  2. Every locale has exactly the same keys as English (nothing missing, nothing stale).
 *  3. ICU placeholders ({name}) match between English and each translation.
 * Dynamic keys (t(`x.${y}`)) are checked by listing the prefix; their concrete values are
 * validated by the second check because English defines them all.
 * Usage: npm run i18n:check   (exits 1 on problems)
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const LOCALES = ["en", "ar", "fr", "es", "it", "zh", "ru", "pt"];
/** Internal back-office text: English for all locales (runtime falls back to English). */
const ENGLISH_ONLY_NAMESPACES = ["admin"];
type Tree = { [k: string]: string | Tree };

function flatten(obj: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(tsx?|ts)$/.test(e.name) ? [p] : [];
  });
}

const messages = Object.fromEntries(LOCALES.map((l) => [l, flatten(JSON.parse(fs.readFileSync(path.join(root, "messages", `${l}.json`), "utf8")))]));
const en = messages.en;
const problems: string[] = [];
const dynamic = new Set<string>();

for (const file of walk(path.join(root, "src"))) {
  const src = fs.readFileSync(file, "utf8");
  // Map translator variable → namespace.
  const vars = new Map<string, string>();
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([\w.]+)"|\{[^}]*namespace:\s*"([\w.]+)"[^}]*\})\s*\)/g)) {
    vars.set(m[1], m[2] ?? m[3]);
  }
  for (const [v, ns] of vars) {
    const re = new RegExp(`\\b${v}(?:\\.rich|\\.has)?\\(\\s*("([^"]+)"|\`([^\`]+)\`)`, "g");
    for (const m of src.matchAll(re)) {
      if (m[2]) {
        const key = `${ns}.${m[2]}`;
        if (!(key in en)) problems.push(`missing in en: ${key}  (${path.relative(root, file)})`);
      } else if (m[3]) {
        const prefix = `${ns}.${m[3].split("${")[0]}`;
        dynamic.add(prefix);
        if (!Object.keys(en).some((k) => k.startsWith(prefix))) problems.push(`no keys for dynamic prefix: ${prefix}  (${path.relative(root, file)})`);
      }
    }
  }
}

const placeholders = (s: string) => Array.from(s.matchAll(/\{(\w+)[,}]/g)).map((m) => m[1]).sort().join(",");
for (const l of LOCALES.filter((x) => x !== "en")) {
  const m = messages[l];
  for (const k of Object.keys(en)) {
    if (ENGLISH_ONLY_NAMESPACES.includes(k.split(".")[0]) && !(k in m)) continue;
    if (!(k in m)) problems.push(`[${l}] missing: ${k}`);
    else if (placeholders(en[k]) !== placeholders(m[k])) problems.push(`[${l}] placeholder mismatch: ${k}  en={${placeholders(en[k])}} ${l}={${placeholders(m[k])}}`);
  }
  for (const k of Object.keys(m)) if (!(k in en)) problems.push(`[${l}] stale key: ${k}`);
}

console.log(`${Object.keys(en).length} keys × ${LOCALES.length} locales; ${dynamic.size} dynamic prefixes.`);
if (problems.length) {
  console.log(problems.join("\n"));
  console.log(`\n${problems.length} problem(s).`);
  process.exitCode = 1;
}
else console.log("i18n OK");
