import "server-only";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __triplanDb?: DB; __triplanDbPromise?: Promise<DB> };

async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");

  if (url.startsWith("pglite:")) {
    // Embedded Postgres for local development & tests — no server to install.
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const client = new PGlite(url.slice("pglite:".length) || undefined);
    // Both drivers expose the same query-builder API; the cast unifies the types.
    return drizzle(client, { schema }) as unknown as DB;
  }

  const client = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    // Transaction poolers (PgBouncer, Neon "-pooler" hosts, Supabase port 6543) don't support prepared statements.
    prepare: !/pgbouncer=true|-pooler\.|:6543\b/.test(url),
  });
  return drizzlePg(client, { schema });
}

/** Lazily-created singleton (survives hot reloads in development). */
export async function getDb(): Promise<DB> {
  if (globalForDb.__triplanDb) return globalForDb.__triplanDb;
  globalForDb.__triplanDbPromise ??= create().then((db) => (globalForDb.__triplanDb = db));
  return globalForDb.__triplanDbPromise;
}

export { schema };
