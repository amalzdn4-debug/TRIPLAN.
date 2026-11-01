/** Raw SQL client used by CLI scripts (migrate/seed). Works with Postgres and PGlite. */

export interface SqlClient {
  exec(sql: string): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

export async function connect(): Promise<SqlClient> {
  // Migrations prefer a direct (non-pooled) connection when the host provides one (e.g. Vercel + Neon).
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (copy .env.example to .env.local).");
  if (url.startsWith("pglite:")) {
    const dir = url.slice("pglite:".length);
    const fs = await import("node:fs");
    if (dir && !dir.startsWith("memory")) fs.mkdirSync(dir, { recursive: true });
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite(dir || undefined);
    return {
      exec: async (sql) => void (await db.exec(sql)),
      query: async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows,
      close: () => db.close(),
    };
  }
  if (url.startsWith("psql-test:")) return (await import(process.env.TRIPLAN_TEST_CLIENT as string)).connectTest(url);
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, { max: 1, prepare: false });
  return {
    exec: async (text) => void (await sql.unsafe(text)),
    query: async <T,>(text: string, params: unknown[] = []) => (await sql.unsafe(text, params as never[])) as unknown as T[],
    close: () => sql.end(),
  };
}
