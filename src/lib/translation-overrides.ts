import "server-only";
import { unstable_cache } from "next/cache";

/**
 * Admin-edited translation overrides (table translation_records), converted to a nested
 * messages object. Fails soft: if the database is unreachable the JSON dictionaries are used.
 */
export const getTranslationOverrides = unstable_cache(
  async (locale: string): Promise<Record<string, unknown>> => {
    try {
      const { getDb, schema } = await import("@/db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      const rows = await db
        .select({ key: schema.translationRecords.key, value: schema.translationRecords.value })
        .from(schema.translationRecords)
        .where(eq(schema.translationRecords.locale, locale));
      const out: Record<string, unknown> = {};
      for (const { key, value } of rows) {
        const parts = key.split(".");
        let node = out as Record<string, unknown>;
        parts.forEach((part, i) => {
          if (i === parts.length - 1) node[part] = value;
          else node = (node[part] ??= {}) as Record<string, unknown>;
        });
      }
      return out;
    } catch {
      return {};
    }
  },
  ["translation-overrides"],
  { revalidate: 300, tags: ["translations"] },
);
